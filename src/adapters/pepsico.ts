import * as cheerio from 'cheerio';
import { fetchJson } from '../http.js';
import { extractPay } from '../pay.js';
import type { RawVacancy } from '../types.js';

// PepsiCo (Walkers, Leicester). Open JSON search; the radius filter still lets
// through jobs abroad, so the country is checked. Pay is in the advert text.
const API = 'https://www.pepsicojobs.com/api/jobs?location=Leicester%2C%20UK&stretch=10&stretchUnit=MILES&limit=100';

interface Job {
  req_id: string;
  slug: string;
  title: string;
  city?: string;
  /** The site, e.g. "Leycroft Road-GBR". */
  location_name?: string;
  country_code?: string;
  posting_expiry_date?: string | null;
  description?: string;
}

export async function fetchPepsico(): Promise<RawVacancy[]> {
  const body = await fetchJson<{ jobs?: { data: Job }[]; totalCount?: number }>(API);
  if (!Array.isArray(body.jobs)) throw new Error('PepsiCo response has no jobs');
  const total = body.totalCount ?? 0;
  if (body.jobs.length < total) throw new Error(`PepsiCo lists ${total} jobs but only ${body.jobs.length} were returned`);
  return body.jobs
    .map((j) => j.data)
    .filter((j) => j.country_code === 'GB')
    .map((j) => ({
      externalId: j.req_id,
      title: j.title.replace(/\s+/g, ' ').trim(),
      locationText: [j.city, j.location_name?.replace(/-GBR$/, '')].filter(Boolean).join(', ') || null,
      url: `https://www.pepsicojobs.com/main/jobs/${j.slug}`,
      closingDate: j.posting_expiry_date ?? null,
      salary: extractPay(cheerio.load(j.description ?? '').text()),
    }));
}
