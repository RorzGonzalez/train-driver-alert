import { fetchJson } from '../http.js';
import type { RawVacancy } from '../types.js';

// Randstad's main site, searched within ten miles of Bournville. The page is a
// React app, but the same JSON its server renders is available from one POST.
// Only the in-house agency's jobs are kept: that is Randstad at the Cadbury site.
const API = 'https://www.randstad.co.uk/api/search/search-results';
const SITE = 'https://www.randstad.co.uk';
const ROUTE = 'west-midlands/bournville';
const PAGE = 30;
const INHOUSE = 'Randstad Inhouse Services';

interface Hit {
  _id: string;
  _source: {
    JobInformation?: { Title?: string };
    JobLocation?: { City?: string; Postcode?: string };
    Salary?: { SalaryMin?: string; SalaryMax?: string; CompensationType?: string };
    JobDates?: { DateExpire?: string };
    JobIdentity?: { CompanyName?: string };
    BlueXSanitized?: { Title?: string; City?: string };
  };
}

function pay(s: Hit['_source']['Salary']): string | null {
  if (!s?.SalaryMin || Number(s.SalaryMin) === 0) return null;
  const range = s.SalaryMax && s.SalaryMax !== s.SalaryMin ? ` - £${s.SalaryMax}` : '';
  return `£${s.SalaryMin}${range} ${s.CompensationType ?? ''}`.trim();
}

export async function fetchRandstadBournville(): Promise<RawVacancy[]> {
  const hits: Hit[] = [];
  let total = Infinity;
  for (let page = 1; (page - 1) * PAGE < total; page++) {
    const route = page === 1 ? ROUTE : `${ROUTE}/page-${page}`;
    const body = await fetchJson<{ searchResults?: { hits?: { total?: number; hits?: Hit[] } } }>(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        data: {
          currentRoute: { url: `/jobs/${route}/`, path: '/jobs/:searchParams*', routeName: 'search', params: { searchParams: route } },
          currentLanguage: 'en',
          cookies: {},
        },
      }),
    });
    const got = body.searchResults?.hits;
    if (!Array.isArray(got?.hits)) throw new Error('Randstad response has no hits');
    total = got.total ?? 0;
    hits.push(...got.hits);
    if (got.hits.length < PAGE) break;
  }
  if (hits.length < total) throw new Error(`Randstad lists ${total} jobs near Bournville but only ${hits.length} were returned`);
  return hits
    .filter((h) => h._source.JobIdentity?.CompanyName === INHOUSE)
    .map((h) => {
      const s = h._source;
      return {
        externalId: h._id,
        title: (s.JobInformation?.Title ?? '').replace(/\s+/g, ' ').trim(),
        locationText: [s.JobLocation?.City, s.JobLocation?.Postcode].filter(Boolean).join(', ') || null,
        url: `${SITE}/jobs/${s.BlueXSanitized?.Title}_${s.BlueXSanitized?.City}_${h._id}/`,
        closingDate: s.JobDates?.DateExpire ?? null,
        salary: pay(s.Salary),
      };
    });
}
