import type { Job, Profile } from "@prisma/client";

// Structured, explainable hard filters applied BEFORE scoring. Each returns a
// clear reason when a job is rejected so the engine can log why.

export type JobLevel = "intern" | "entry" | "mid" | "senior" | "lead";
export type EmploymentType =
  | "full_time"
  | "part_time"
  | "contract"
  | "internship"
  | "temporary";

export interface FilterOutcome {
  passed: boolean;
  reason?: string;
}

const US_STATES = new Set([
  "al","ak","az","ar","ca","co","ct","de","fl","ga","hi","id","il","in","ia","ks","ky","la","me",
  "md","ma","mi","mn","ms","mo","mt","ne","nv","nh","nj","nm","ny","nc","nd","oh","ok","or","pa",
  "ri","sc","sd","tn","tx","ut","vt","va","wa","wv","wi","wy","dc",
]);

/** Smallest "N years" requirement stated in the text, or null if none found. */
export function parseMinYearsExperience(text: string): number | null {
  const t = text.toLowerCase();
  const found: number[] = [];
  // "3-5 years", "3 to 5 years", "3+ years", "minimum 4 years", "at least 2 yrs"
  const range = /(\d{1,2})\s*(?:\+|-|–|to)\s*(\d{1,2})?\s*\+?\s*(?:years?|yrs?)/g;
  for (const m of t.matchAll(range)) {
    const lo = Number.parseInt(m[1]!, 10);
    if (Number.isFinite(lo) && lo <= 20) found.push(lo);
  }
  const plus = /(\d{1,2})\s*\+\s*(?:years?|yrs?)/g;
  for (const m of t.matchAll(plus)) {
    const n = Number.parseInt(m[1]!, 10);
    if (Number.isFinite(n) && n <= 20) found.push(n);
  }
  const atLeast = /(?:minimum|at least|min\.?)\s*(?:of\s*)?(\d{1,2})\s*(?:years?|yrs?)/g;
  for (const m of t.matchAll(atLeast)) {
    const n = Number.parseInt(m[1]!, 10);
    if (Number.isFinite(n) && n <= 20) found.push(n);
  }
  if (found.length === 0) return null;
  // Most lenient reading: the smallest stated floor.
  return Math.min(...found);
}

/** Classify a job's seniority from its title (description as a fallback). */
export function classifyLevel(title: string, description = ""): JobLevel {
  const t = title.toLowerCase();
  if (/\bintern(ship)?\b/.test(t)) return "intern";
  if (/\b(lead|principal|staff|director|vp|head of|architect)\b/.test(t)) return "lead";
  if (/\b(senior|sr\.?)\b/.test(t)) return "senior";
  if (
    /\b(junior|jr\.?|entry[\s-]?level|new[\s-]?grad(uate)?|graduate|associate|early[\s-]?career|campus|university grad)\b/.test(
      t,
    )
  ) {
    return "entry";
  }
  // Title gave nothing decisive; let a very low experience floor imply entry.
  const minYears = parseMinYearsExperience(description);
  if (minYears !== null && minYears <= 1) return "entry";
  return "mid";
}

/** Classify employment type from text; "unknown" when nothing is stated. */
export function classifyEmploymentType(text: string): EmploymentType | "unknown" {
  const t = text.toLowerCase();
  if (/\b(intern|internship)\b/.test(t)) return "internship";
  if (/\b(part[\s-]?time)\b/.test(t)) return "part_time";
  if (/\b(contract|contractor|freelance|fixed[\s-]?term)\b/.test(t)) return "contract";
  if (/\b(temporary|temp\b|seasonal)\b/.test(t)) return "temporary";
  if (/\b(full[\s-]?time|permanent|fte)\b/.test(t)) return "full_time";
  return "unknown";
}

function looksUS(loc: string): boolean {
  const l = loc.toLowerCase();
  if (/united states|u\.s\.a?\.?|\busa\b|\bus\b|remote[,\s-]*us/.test(l)) return true;
  // trailing or comma-separated 2-letter state code, e.g. "Seattle, WA"
  const tokens = l.split(/[^a-z]+/).filter(Boolean);
  return tokens.some((tok) => tok.length === 2 && US_STATES.has(tok));
}

/** Strict location include-list: job must match an allowed place or be remote. */
export function locationAllowed(
  job: Pick<Job, "location" | "remote">,
  allowed: string[],
  remoteOk: boolean,
): boolean {
  if (job.remote && remoteOk) return true;
  if (allowed.length === 0) return true;
  const loc = (job.location ?? "").toLowerCase();
  if (!loc) return false;
  for (const raw of allowed) {
    const a = raw.trim().toLowerCase();
    if (!a) continue;
    if (a === "remote") {
      if (job.remote) return true;
      continue;
    }
    if (a === "united states" || a === "usa" || a === "us") {
      if (looksUS(loc)) return true;
      continue;
    }
    const city = a.split(",")[0]!.trim();
    if (city && loc.includes(city)) return true;
    if (a.length === 2 && US_STATES.has(a) && new RegExp(`\\b${a}\\b`).test(loc)) return true;
  }
  return false;
}

export function sponsorshipSignal(text: string): "positive" | "negative" | "unknown" {
  const t = text.toLowerCase();
  const negative =
    /no (visa )?sponsorship|not (able )?to sponsor|unable to sponsor|without sponsorship|do(es)? not (provide|offer|support) (visa )?sponsorship|must (already )?be (authorized|eligible) to work|no visa\b/.test(
      t,
    );
  const positive =
    /visa sponsorship(?: is)? (?:available|offered|provided|supported)|will(?:ing to)? sponsor|we sponsor|sponsorship available|open to sponsor|able to sponsor|offer(?:s)? (?:visa )?sponsorship/.test(
      t,
    );
  if (negative && !positive) return "negative";
  if (positive && !negative) return "positive";
  return "unknown";
}

export function firstExcludedKeyword(text: string, keywords: string[]): string | null {
  const t = text.toLowerCase();
  for (const k of keywords) {
    const kk = k.trim().toLowerCase();
    if (kk && t.includes(kk)) return k;
  }
  return null;
}

/**
 * Apply every configured hard filter from the profile. Returns the first
 * failing reason, or { passed: true }. Empty/unset settings are no-ops, so a
 * blank profile passes everything (preserving the old soft-matching behavior).
 */
export function applyFilters(profile: Profile, job: Job): FilterOutcome {
  const haystack = `${job.title}\n${job.descriptionText}`;

  // 1. Exclude keywords.
  const excluded = firstExcludedKeyword(haystack, profile.excludeKeywords);
  if (excluded) return { passed: false, reason: `excluded keyword "${excluded}"` };

  // 2. Recency.
  if (profile.maxJobAgeHours && profile.maxJobAgeHours > 0) {
    const when = job.postedAt ?? job.discoveredAt;
    const ageHours = (Date.now() - new Date(when).getTime()) / 3_600_000;
    if (ageHours > profile.maxJobAgeHours) {
      return { passed: false, reason: `older than ${profile.maxJobAgeHours}h (${Math.round(ageHours)}h)` };
    }
  }

  // 3. Strict location include-list.
  if (profile.strictLocations && !locationAllowed(job, profile.locationsPreferred, profile.remoteOk)) {
    return { passed: false, reason: `location "${job.location ?? "unknown"}" not in allowed set` };
  }

  // 4. Level.
  if (profile.allowedLevels.length > 0) {
    const level = classifyLevel(job.title, job.descriptionText);
    if (!profile.allowedLevels.includes(level)) {
      return { passed: false, reason: `level "${level}" not allowed` };
    }
  }

  // 5. Employment type (unknown passes when full_time is allowed).
  if (profile.allowedEmploymentTypes.length > 0) {
    const type = classifyEmploymentType(haystack);
    const effective = type === "unknown" ? "full_time" : type;
    if (!profile.allowedEmploymentTypes.includes(effective)) {
      return { passed: false, reason: `employment type "${type}" not allowed` };
    }
  }

  // 6. Max experience.
  if (profile.maxExperienceYears !== null && profile.maxExperienceYears !== undefined) {
    const minYears = parseMinYearsExperience(job.descriptionText);
    if (minYears !== null && minYears > profile.maxExperienceYears) {
      return { passed: false, reason: `requires ${minYears}+ yrs (> your ${profile.maxExperienceYears})` };
    }
  }

  // 7. Sponsorship.
  if (profile.requiresSponsorship) {
    const signal = sponsorshipSignal(haystack);
    if (signal === "negative") {
      return { passed: false, reason: "posting states no visa sponsorship" };
    }
    if (profile.requirePositiveSponsorship && signal !== "positive") {
      return { passed: false, reason: "no explicit visa-sponsorship offer" };
    }
  }

  return { passed: true };
}
