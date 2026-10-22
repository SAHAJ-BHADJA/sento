import { atsFetch, looksRemote, stripHtml, type AtsConnector, type NormalizedJob } from "./types";

// Lever public postings API:
//   https://api.lever.co/v0/postings/{company}?mode=json
interface LeverPosting {
  id: string;
  text: string; // title
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
  descriptionPlain?: string;
  description?: string;
  categories?: { location?: string; team?: string; commitment?: string };
  workplaceType?: string; // "remote" | "on-site" | "hybrid"
}

export const lever: AtsConnector = {
  type: "LEVER",
  async fetchJobs(company: string): Promise<NormalizedJob[]> {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`;
    const res = await atsFetch(url);
    if (!res.ok) {
      throw new Error(`lever company "${company}" returned ${res.status}`);
    }
    const postings = (await res.json()) as LeverPosting[];
    return postings.map((p) => {
      const description = p.descriptionPlain?.trim() || stripHtml(p.description);
      const location = p.categories?.location;
      return {
        externalId: p.id,
        title: p.text,
        location,
        department: p.categories?.team,
        url: p.hostedUrl || p.applyUrl || "",
        descriptionText: description,
        remote: p.workplaceType === "remote" || looksRemote(location, p.text, description),
        postedAt: p.createdAt ? new Date(p.createdAt) : undefined,
        raw: p,
      } satisfies NormalizedJob;
    });
  },
};
