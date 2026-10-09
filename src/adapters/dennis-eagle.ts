import * as cheerio from 'cheerio';
import { fetchJson } from '../http.js';
import { extractPay } from '../pay.js';
import type { RawVacancy } from '../types.js';

// Dennis Eagle (Greenhouse board for all its sites). One response holds every
// job with its advert text, which arrives HTML-escaped twice.
const API = 'https://boards-api.greenhouse.io/v1/boards/denniseagleuk/jobs?content=true';

interface Job {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  application_deadline?: string | null;
  content?: string;
}

export async function fetchDennisEagle(): Promise<RawVacancy[]> {
  const body = await fetchJson<{ jobs?: Job[]; meta?: { total?: number } }>(API);
  if (!Array.isArray(body.jobs)) throw new Error('Dennis Eagle response has no jobs');
  const total = body.meta?.total ?? 0;
  if (body.jobs.length < total) throw new Error(`Dennis Eagle lists ${total} jobs but only ${body.jobs.length} were returned`);
  return body.jobs.map((j) => ({
    externalId: String(j.id),
    title: j.title.replace(/\s+/g, ' ').trim(),
    locationText: j.location?.name?.trim() || null,
    url: j.absolute_url,
    closingDate: j.application_deadline ?? null,
    salary: extractPay(cheerio.load(cheerio.load(j.content ?? '').text()).text()),
  }));
}
