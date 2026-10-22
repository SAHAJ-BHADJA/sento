import { atsFetch, looksRemote, stripHtml, type AtsConnector, type NormalizedJob } from "./types";

// Greenhouse public job board API:
//   https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
interface GreenhouseJob {
  id: number;
  title: string;
  updated_at?: string;
  absolute_url: string;
  content?: string; // HTML, present when content=true
  location?: { name?: string };
  departments?: { name?: string }[];
}

export const greenhouse: AtsConnector = {
  type: "GREENHOUSE",
  async fetchJobs(token: string): Promise<NormalizedJob[]> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;
    const res = await atsFetch(url);
    if (!res.ok) {
      throw new Error(`greenhouse board "${token}" returned ${res.status}`);
    }
    const body = (await res.json()) as { jobs?: GreenhouseJob[] };
    const jobs = body.jobs ?? [];
    return jobs.map((j) => {
      const description = stripHtml(j.content);
      const location = j.location?.name;
      return {
        externalId: String(j.id),
        title: j.title,
        location,
        department: j.departments?.[0]?.name,
        url: j.absolute_url,
        descriptionText: description,
        remote: looksRemote(location, j.title, description),
        postedAt: j.updated_at ? new Date(j.updated_at) : undefined,
        raw: j,
      } satisfies NormalizedJob;
    });
  },
};
