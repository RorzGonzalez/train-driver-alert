import * as cheerio from 'cheerio';
import { fetchJson } from '../http.js';
import type { RawVacancy } from '../types.js';
import { workday } from './workday.js';

// Heavy Haul Rail (the former Freightliner Heavy Haul, separate since January
// 2026). Qualified-driver jobs go on Workday; trainee schemes have been
// published as PDFs on the company website instead, so recent media uploads
// mentioning "driver" are watched too.
const wd = workday({ host: 'gandwukeurope.wd3.myworkdayjobs.com', tenant: 'gandwukeurope', site: 'HHRailExt' });
const MEDIA = 'https://www.heavyhaulrail.co.uk/wp-json/wp/v2/media?search=driver&per_page=20&_fields=id,date,title,source_url';
const MEDIA_MAX_AGE_DAYS = 60;

interface Media {
  id: number;
  date: string;
  title: { rendered: string };
  source_url: string;
}

async function fetchMedia(): Promise<RawVacancy[]> {
  const items = await fetchJson<Media[]>(MEDIA);
  if (!Array.isArray(items)) throw new Error('Heavy Haul Rail media response is not a list');
  const cutoff = Date.now() - MEDIA_MAX_AGE_DAYS * 86_400_000;
  return items
    .filter((m) => new Date(m.date).getTime() >= cutoff)
    .map((m) => ({
      externalId: `media-${m.id}`,
      title: cheerio.load(m.title.rendered).text().trim(),
      locationText: null,
      url: m.source_url,
      closingDate: null,
    }));
}

export async function fetchHeavyHaul(): Promise<RawVacancy[]> {
  const [jobs, media] = await Promise.all([wd.fetch(), fetchMedia()]);
  return [...jobs, ...media];
}

export async function enrichHeavyHaul(v: RawVacancy): Promise<Partial<RawVacancy>> {
  return v.externalId.startsWith('media-') ? {} : wd.enrich(v);
}
