import { atsFetch, looksRemote, stripHtml, type AtsConnector, type NormalizedJob } from "./types";

// Ashby public job board API:
//   https://api.ashbyhq.com/posting-api/job-board/{boardName}
interface AshbyPosting {
  id: string;
  title: string;
  location?: string;
  department?: string;
  team?: string;
  isRemote?: boolean;
  publishedAt?: string;
  jobUrl?: string;
  applyUrl?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
}

export const ashby: AtsConnector = {
  type: "ASHBY",
  async fetchJobs(board: string): Promise<NormalizedJob[]> {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}?includeCompensation=true`;
    const res = await atsFetch(url);
    if (!res.ok) {
      throw new Error(`ashby board "${board}" returned ${res.status}`);
    }
    const body = (await res.json()) as { jobs?: AshbyPosting[] };
    const jobs = body.jobs ?? [];
    return jobs.map((j) => {
      const description = j.descriptionPlain?.trim() || stripHtml(j.descriptionHtml);
      return {
        externalId: j.id,
        title: j.title,
        location: j.location,
        department: j.department ?? j.team,
        url: j.jobUrl || j.applyUrl || "",
        descriptionText: description,
        remote: Boolean(j.isRemote) || looksRemote(j.location, j.title, description),
        postedAt: j.publishedAt ? new Date(j.publishedAt) : undefined,
        raw: j,
      } satisfies NormalizedJob;
    });
  },
};
