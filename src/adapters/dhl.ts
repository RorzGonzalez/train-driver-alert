import { fetchJson } from '../http.js';
import { extractPay } from '../pay.js';
import type { RawVacancy } from '../types.js';

// DHL (Phenom). The search page is built in the browser from one POST that
// takes the towns to search. Pay is the first figure in the advert teaser.
const API = 'https://careers.dhl.com/widgets';
const SIZE = 100;
const TOWNS = [
  'Coventry', 'Daventry', 'Rugby', 'Lutterworth', 'Northampton', 'Leamington Spa', 'Warwick', 'Birmingham', 'Nuneaton', 'Hinckley',
  'Coleshill', 'Solihull', 'Tamworth', 'Leicester', 'Milton Keynes', 'Banbury', 'Redditch', 'Wolverhampton', 'Walsall', 'Lichfield',
  'Kenilworth', 'Atherstone', 'Bedworth', 'Crick', 'Minworth',
];

interface Job {
  jobSeqNo: string;
  title: string;
  /** "Coventry, Coventry, CV8 3LF, United Kingdom" */
  location?: string;
  /** "Coventry:DC2" */
  address?: string;
  descriptionTeaser?: string;
}

// "Coventry, Coventry, CV8 3LF, United Kingdom" + "Coventry:DC2" -> "Coventry, CV8 3LF (DC2)"
function place(j: Job): string | null {
  const parts = (j.location ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const postcode = parts.find((p) => /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(p));
  const town = [parts[0], postcode].filter(Boolean).join(', ');
  const site = j.address?.split(':').pop()?.trim();
  return [town, site && `(${site})`].filter(Boolean).join(' ') || null;
}

export async function fetchDhl(): Promise<RawVacancy[]> {
  const all: RawVacancy[] = [];
  let total = Infinity;
  for (let from = 0; from < total; from += SIZE) {
    const body = await fetchJson<{ refineSearch?: { totalHits?: number; data?: { jobs?: Job[] } } }>(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        lang: 'en_global', deviceType: 'desktop', country: 'global', pageName: 'search-results', ddoKey: 'refineSearch',
        sortBy: 'Most recent', subsearch: '', from, jobs: true, counts: true, all_fields: ['category', 'country', 'state', 'city'],
        size: SIZE, clearAll: false, jdsource: 'facets', isSliderEnable: false, pageId: 'page20', siteType: 'external', keywords: '',
        global: true, selected_fields: { country: ['United Kingdom'], city: TOWNS }, locationData: {},
      }),
    });
    const jobs = body.refineSearch?.data?.jobs;
    if (!Array.isArray(jobs)) throw new Error('DHL response has no jobs');
    total = body.refineSearch?.totalHits ?? 0;
    for (const j of jobs) {
      const title = j.title.replace(/\s+/g, ' ').trim();
      all.push({
        externalId: j.jobSeqNo,
        title,
        locationText: place(j),
        url: `https://careers.dhl.com/global/en/job/${j.jobSeqNo}/${title.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
        closingDate: null,
        salary: extractPay(j.descriptionTeaser ?? ''),
      });
    }
    if (jobs.length < SIZE) break;
  }
  if (all.length < total) throw new Error(`DHL lists ${total} jobs but only ${all.length} were returned`);
  return all;
}
