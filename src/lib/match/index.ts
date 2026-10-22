import type { Job, Profile } from "@prisma/client";

export interface MatchResult {
  score: number; // 0-100
  reasons: string[];
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9+#.\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1),
  );
}

function titleOverlap(targetTitles: string[], jobTitle: string): number {
  if (targetTitles.length === 0) return 0;
  const jt = jobTitle.toLowerCase();
  let best = 0;
  for (const t of targetTitles) {
    const words = t.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    const hits = words.filter((w) => jt.includes(w)).length;
    best = Math.max(best, hits / words.length);
  }
  return best; // 0..1
}

function locationFit(profile: Profile, job: Job): { fit: number; reason: string } {
  if (job.remote) return { fit: 1, reason: "role is remote" };
  if (profile.remoteOnly) return { fit: 0, reason: "you want remote-only but role is not remote" };
  const prefs = profile.locationsPreferred.map((l) => l.toLowerCase());
  if (prefs.length === 0) return { fit: 0.6, reason: "no location preference set" };
  const loc = (job.location ?? "").toLowerCase();
  const hit = prefs.some((p) => p !== "remote" && loc.includes(p.split(",")[0]!.trim()));
  if (hit) return { fit: 1, reason: `location matches a preference (${job.location})` };
  return { fit: 0.3, reason: `location (${job.location ?? "unknown"}) not in your preferences` };
}

/**
 * Score a job against a profile. Deterministic and explainable: the weights
 * are fixed and every contribution is reported in `reasons`.
 *
 * Weights: title 40, skills 35, location 20, work-auth gate 5 (and a hard
 * zero when sponsorship is required but the posting rules it out).
 */
export function scoreJob(profile: Profile, job: Job): MatchResult {
  const reasons: string[] = [];
  const haystack = `${job.title} ${job.descriptionText}`.toLowerCase();

  // Note: hard gates (sponsorship, level, recency, location, experience,
  // employment type, exclusions) live in src/lib/filters and run before this
  // scorer. scoreJob is pure ranking of jobs that already passed those filters.
  const titleScore = titleOverlap(profile.titles, job.title); // 0..1
  reasons.push(`title relevance ${(titleScore * 100).toFixed(0)}%`);

  const jobTokens = tokenize(haystack);
  const skills = profile.skills.map((s) => s.toLowerCase());
  const matchedSkills = skills.filter((s) =>
    s.includes(" ") ? haystack.includes(s) : jobTokens.has(s),
  );
  const skillScore = skills.length === 0 ? 0 : matchedSkills.length / skills.length; // 0..1
  if (matchedSkills.length > 0) {
    reasons.push(`skills matched: ${matchedSkills.slice(0, 8).join(", ")}`);
  } else {
    reasons.push("no profile skills found in posting");
  }

  const loc = locationFit(profile, job);
  reasons.push(loc.reason);

  const authFit = profile.requiresSponsorship ? 0.5 : 1;

  const score = Math.round(
    titleScore * 40 + skillScore * 35 + loc.fit * 20 + authFit * 5,
  );

  return { score: Math.max(0, Math.min(100, score)), reasons };
}
