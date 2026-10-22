import type { ApplicationStatus, Company, Profile } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";
import { logger } from "./log";
import { fetchBoard } from "./ats/index";
import { scoreJob } from "./match/index";
import { tailor } from "./tailor/index";
import { submitApplication } from "./submit/index";

const log = logger("engine");

async function recordEvent(
  applicationId: string,
  type: string,
  message: string,
  data?: unknown,
): Promise<void> {
  await prisma.applicationEvent.create({
    data: { applicationId, type, message, data: (data ?? undefined) as never },
  });
}

/** Poll one company's ATS board and upsert any new/changed jobs. */
export async function discoverForCompany(company: Company): Promise<number> {
  const result = await fetchBoard(company.atsType, company.atsIdentifier);
  await prisma.company.update({
    where: { id: company.id },
    data: { lastPolledAt: new Date() },
  });
  if (!result.ok) {
    log.warn("board fetch failed", { company: company.name, reason: result.reason });
    return 0;
  }
  let created = 0;
  for (const j of result.jobs) {
    const existing = await prisma.job.findUnique({
      where: { companyId_externalId: { companyId: company.id, externalId: j.externalId } },
    });
    if (existing) continue;
    await prisma.job.create({
      data: {
        companyId: company.id,
        externalId: j.externalId,
        title: j.title,
        location: j.location ?? null,
        department: j.department ?? null,
        url: j.url,
        descriptionText: j.descriptionText,
        remote: j.remote,
        postedAt: j.postedAt ?? null,
        raw: (j.raw ?? undefined) as never,
      },
    });
    created++;
  }
  log.info("discovered jobs", { company: company.name, created });
  return created;
}

/** Poll every active company whose poll interval has elapsed. */
export async function discoverAll(): Promise<number> {
  const cutoff = new Date(Date.now() - env.pollIntervalSeconds * 1000);
  const companies = await prisma.company.findMany({
    where: { active: true, OR: [{ lastPolledAt: null }, { lastPolledAt: { lt: cutoff } }] },
  });
  let total = 0;
  for (const c of companies) total += await discoverForCompany(c);
  return total;
}

/**
 * Score recent jobs for one user and create applications for those at or above
 * the match threshold. Jobs below threshold are not persisted as applications.
 */
export async function matchForUser(userId: string): Promise<number> {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return 0;

  const already = await prisma.application.findMany({
    where: { userId },
    select: { jobId: true },
  });
  const seen = new Set(already.map((a) => a.jobId));

  const jobs = await prisma.job.findMany({ orderBy: { discoveredAt: "desc" }, take: 500 });
  let created = 0;
  for (const job of jobs) {
    if (seen.has(job.id)) continue;
    const { score, reasons } = scoreJob(profile, job);
    if (score < env.matchThreshold) continue;
    const app = await prisma.application.create({
      data: {
        userId,
        jobId: job.id,
        status: "MATCHED",
        matchScore: score,
        matchReasons: reasons,
      },
    });
    await recordEvent(app.id, "matched", `Matched "${job.title}" at ${score}%`, { reasons });
    created++;
  }
  return created;
}

/** Generate tailored materials for one matched application. */
export async function tailorApplication(applicationId: string): Promise<void> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: true, user: { include: { profile: true } } },
  });
  if (!app || !app.user.profile) return;
  await setStatus(applicationId, "TAILORING");

  const materials = await tailor(app.user.profile as Profile, app.job);
  await prisma.application.update({
    where: { id: applicationId },
    data: {
      tailoredResumeText: materials.resumeText,
      coverLetterText: materials.coverLetterText,
      status: "READY",
    },
  });
  await recordEvent(
    applicationId,
    "tailored",
    materials.available
      ? "Tailored résumé and cover letter generated"
      : `Tailoring unavailable: ${materials.note}`,
  );
}

/** Attempt to submit one ready/queued application. */
export async function processApplication(applicationId: string): Promise<ApplicationStatus> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: true, user: { include: { profile: true } } },
  });
  if (!app || !app.user.profile) return "FAILED";

  if (app.user.credits <= 0) {
    await recordEvent(applicationId, "blocked", "Out of application credits");
    return app.status;
  }

  await setStatus(applicationId, "SUBMITTING");
  const outcome = await submitApplication(app, app.job, app.user.profile as Profile);

  if (outcome.status === "submitted") {
    await prisma.$transaction([
      prisma.application.update({
        where: { id: applicationId },
        data: { status: "SUBMITTED", submittedAt: new Date(), receiptPath: outcome.receiptPath },
      }),
      // Billing only for submitted applications.
      prisma.user.update({ where: { id: app.userId }, data: { credits: { decrement: 1 } } }),
    ]);
    await recordEvent(applicationId, "submitted", "Application submitted", {
      filled: outcome.filled,
    });
    return "SUBMITTED";
  }

  if (outcome.status === "needs_you") {
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: "NEEDS_YOU",
        needsReason: outcome.reason,
        receiptPath: outcome.receiptPath ?? null,
      },
    });
    await recordEvent(applicationId, "needs_you", outcome.reason, { filled: outcome.filled });
    return "NEEDS_YOU";
  }

  await prisma.application.update({
    where: { id: applicationId },
    data: { status: "FAILED", needsReason: outcome.reason },
  });
  await recordEvent(applicationId, "failed", outcome.reason);
  return "FAILED";
}

async function setStatus(applicationId: string, status: ApplicationStatus): Promise<void> {
  await prisma.application.update({ where: { id: applicationId }, data: { status } });
}

/**
 * One full engine cycle: discover new jobs, match them for every user, tailor
 * matched applications, then submit ready ones (gated by the approval setting).
 */
export async function runCycle(): Promise<void> {
  const discovered = await discoverAll();
  log.info("cycle: discovery done", { discovered });

  const users = await prisma.user.findMany({ select: { id: true } });
  for (const { id: userId } of users) {
    const matched = await matchForUser(userId);
    if (matched) log.info("cycle: matched", { userId, matched });

    const toTailor = await prisma.application.findMany({ where: { userId, status: "MATCHED" } });
    for (const a of toTailor) await tailorApplication(a.id);

    // READY → QUEUED (auto). The real approval gate is the submit click itself.
    await prisma.application.updateMany({
      where: { userId, status: "READY" },
      data: { status: "QUEUED" },
    });

    const queued = await prisma.application.findMany({ where: { userId, status: "QUEUED" } });
    for (const a of queued) await processApplication(a.id);
  }
}
