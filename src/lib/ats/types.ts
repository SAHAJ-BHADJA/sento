import type { AtsType } from "@prisma/client";

/** A job posting normalized across every ATS into one shape. */
export interface NormalizedJob {
  externalId: string;
  title: string;
  location?: string;
  department?: string;
  url: string;
  descriptionText: string;
  remote: boolean;
  postedAt?: Date;
  raw: unknown;
}

/** A read-only connector to one ATS's public job-board API. */
export interface AtsConnector {
  readonly type: AtsType;
  /** `identifier` is the board token / company slug for this ATS. */
  fetchJobs(identifier: string): Promise<NormalizedJob[]>;
}

/** Collapse HTML job descriptions to readable plain text. */
export function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function looksRemote(...fields: (string | undefined | null)[]): boolean {
  const hay = fields.filter(Boolean).join(" ").toLowerCase();
  return /\bremote\b|work from home|wfh|distributed/.test(hay);
}

/** A polite fetch with a descriptive UA and a timeout. */
export async function atsFetch(url: string, timeoutMs = 20_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: {
        // Identify the bot honestly rather than masquerading as a browser.
        "user-agent": "Sento-JobAgent/0.1 (+https://github.com/; job-seeker automation)",
        accept: "application/json",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
