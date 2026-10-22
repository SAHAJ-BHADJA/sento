import type { AtsType } from "@prisma/client";
import { greenhouse } from "./greenhouse";
import { lever } from "./lever";
import { ashby } from "./ashby";
import type { AtsConnector, NormalizedJob } from "./types";

export type { NormalizedJob, AtsConnector } from "./types";

// Registry of implemented connectors. Workday and other ATSes are not yet
// implemented here: Workday exposes a per-tenant JSON endpoint that needs a
// tenant+site pair rather than a single slug, so it is tracked as a known
// unknown instead of being faked.
const CONNECTORS: Partial<Record<AtsType, AtsConnector>> = {
  GREENHOUSE: greenhouse,
  LEVER: lever,
  ASHBY: ashby,
};

export const SUPPORTED_ATS: AtsType[] = Object.keys(CONNECTORS) as AtsType[];

export function connectorFor(type: AtsType): AtsConnector | null {
  return CONNECTORS[type] ?? null;
}

export function isSupported(type: AtsType): boolean {
  return type in CONNECTORS;
}

/**
 * Fetch and normalize every current posting for a board. Returns a tagged
 * result so callers can keep the failure reason instead of guessing.
 */
export async function fetchBoard(
  type: AtsType,
  identifier: string,
): Promise<{ ok: true; jobs: NormalizedJob[] } | { ok: false; reason: string }> {
  const connector = connectorFor(type);
  if (!connector) {
    return { ok: false, reason: `ATS "${type}" has no implemented connector` };
  }
  try {
    const jobs = await connector.fetchJobs(identifier);
    return { ok: true, jobs };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
