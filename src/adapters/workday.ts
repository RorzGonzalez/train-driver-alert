import { fetchJson } from '../http.js';
import type { RawVacancy } from '../types.js';

// Workday career sites share one JSON API. Pages are capped at 20 and the
// total is only reported on the first page.
const LIMIT = 20;

export interface WorkdayConfig {
  host: string;
  tenant: string;
  site: string;
  /** Searches to run and merge; defaults to one unfiltered search. */
  queries?: Record<string, unknown>[];
}

interface Posting {
  title: string;
  externalPath: string;
  locationsText: string;
  bulletFields: string[];
}

interface Detail {
  jobPostingInfo?: {
    endDate?: string;
    location?: string;
    additionalLocations?: (string | { descriptor?: string })[];
  };
}

export function workday(cfg: WorkdayConfig) {
  const api = `https://${cfg.host}/wday/cxs/${cfg.tenant}/${cfg.site}`;
  const site = `https://${cfg.host}/en-US/${cfg.site}`;

  async function search(query: Record<string, unknown>): Promise<Posting[]> {
    const all: Posting[] = [];
    let total = Infinity;
    for (let offset = 0; offset < total; offset += LIMIT) {
      const body = await fetchJson<{ total?: number; jobPostings?: Posting[] }>(`${api}/jobs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ appliedFacets: {}, searchText: '', ...query, limit: LIMIT, offset }),
      });
      if (!Array.isArray(body.jobPostings)) throw new Error(`${cfg.site}: Workday response has no jobPostings`);
      if (offset === 0) total = body.total ?? 0;
      all.push(...body.jobPostings);
      if (body.jobPostings.length < LIMIT) break;
    }
    return all;
  }

  async function fetch(): Promise<RawVacancy[]> {
    const pages = await Promise.all((cfg.queries ?? [{}]).map(search));
    const byId = new Map<string, RawVacancy>();
    for (const p of pages.flat()) {
      const externalId = p.bulletFields?.[0] || p.externalPath;
      byId.set(externalId, {
        externalId,
        title: p.title.trim(),
        locationText: p.locationsText || null,
        url: site + p.externalPath,
        closingDate: null,
      });
    }
    return [...byId.values()];
  }

  async function enrich(v: RawVacancy): Promise<Partial<RawVacancy>> {
    const info = (await fetchJson<Detail>(api + v.url.slice(site.length))).jobPostingInfo;
    if (!info) return {};
    const places = [info.location, ...(info.additionalLocations ?? []).map((l) => (typeof l === 'string' ? l : l.descriptor))]
      .filter((p): p is string => Boolean(p));
    return { closingDate: info.endDate ?? null, ...(places.length ? { locationText: places.join(', ') } : {}) };
  }

  return { fetch, enrich };
}
