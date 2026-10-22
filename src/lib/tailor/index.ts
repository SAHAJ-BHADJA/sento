import type { Job, Profile } from "@prisma/client";
import { complete } from "../anthropic";
import { capabilities } from "../env";

export interface TailoredMaterials {
  resumeText: string;
  coverLetterText: string;
  available: boolean;
  note?: string;
}

const RESUME_SYSTEM = `You are an expert résumé editor helping a job seeker apply to a specific role.
Rewrite the candidate's base résumé so it is honest, concise, and tuned to the target job.
Hard rules:
- Never invent experience, employers, dates, degrees, or skills the candidate does not have.
- Only reorder, reword, and re-emphasize true content already present in the base résumé.
- Keep it ATS-friendly: plain text, clear section headers, bullet points with strong verbs.
- Mirror the job's real keywords ONLY where they truthfully apply to the candidate.
Return only the résumé text, no preamble.`;

const COVER_SYSTEM = `You write short, specific, non-generic cover letters for a job seeker.
Hard rules:
- 180-250 words, first person, warm but professional.
- Reference concrete, true details from the candidate's background and the role.
- No clichés ("I am writing to express"), no invented facts, no flattery about the company that isn't grounded.
Return only the letter text, no preamble.`;

function jobBrief(job: Job): string {
  return [
    `Title: ${job.title}`,
    job.location ? `Location: ${job.location}` : "",
    job.department ? `Team: ${job.department}` : "",
    "",
    "Job description:",
    job.descriptionText.slice(0, 6000),
  ]
    .filter(Boolean)
    .join("\n");
}

function profileBrief(profile: Profile): string {
  return [
    `Name: ${profile.fullName}`,
    profile.location ? `Based in: ${profile.location}` : "",
    profile.titles.length ? `Target titles: ${profile.titles.join(", ")}` : "",
    profile.skills.length ? `Skills: ${profile.skills.join(", ")}` : "",
    "",
    "Base résumé:",
    profile.baseResumeText || "(no base résumé provided)",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Produce a tailored résumé and cover letter for one job. When tailoring is
 * not configured (no Anthropic key), returns the base résumé unchanged with
 * `available: false` so the pipeline can still proceed to a human review.
 */
export async function tailor(profile: Profile, job: Job): Promise<TailoredMaterials> {
  if (!capabilities.tailoring()) {
    return {
      resumeText: profile.baseResumeText,
      coverLetterText: "",
      available: false,
      note: "ANTHROPIC_API_KEY not set — using base résumé verbatim; no cover letter generated.",
    };
  }

  const brief = `${profileBrief(profile)}\n\n----\n\n${jobBrief(job)}`;

  const [resumeText, coverLetterText] = await Promise.all([
    complete(RESUME_SYSTEM, brief, 2600),
    complete(COVER_SYSTEM, brief, 900),
  ]);

  return {
    resumeText: resumeText || profile.baseResumeText,
    coverLetterText: coverLetterText || "",
    available: true,
  };
}
