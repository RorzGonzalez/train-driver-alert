import { fetchJson, fetchText } from '../http.js';
import type { RawVacancy } from '../types.js';

// Chiltern Railways (MHR iTrent). The search endpoint needs a per-page-load
// session token and a Referer; without the Referer it returns an HTML stub.
const BASE = 'https://ce0834li.webitrent.com/ce0834li_webrecruitment/wrd/run';
const WVID = '68317141Hv';
const LISTING = `${BASE}/ETREC179GF.open?WVID=${WVID}`;
const PAGE_SIZE = 100;

interface Result {
  vacancy_id: string;
  job_title: string;
  location_id: string;
  region_id: string;
  app_close_d: string;
  salary: string | null;
}

export async function fetchChiltern(): Promise<RawVacancy[]> {
  const page = await fetchText(LISTING);
  const session = page.match(/name="SESSION\.STD_HID_FLDS\.ET_BASE\.1-1" value="([^"]+)"/)?.[1];
  if (!session) throw new Error('Chiltern listing page has no session token');

  const params = `WVID=${WVID}&USESSION=${session}&LANG=USA`;
  const search = `${params}&JOB_TITLE=&KEYWORDS=&LOCATION_ID=&REGION_ID=&VAC_TYPES=&SALARY_BAND=&ORDER_BY=VACANCY_D&RESULTS_PP=${PAGE_SIZE}&REC_FROM=1&REC_TO=${PAGE_SIZE}`;
  const body = await fetchJson<{ search: { total_rec: number }; results: Result[] }>(`${BASE}/etrec106gf.json?${params}`, {
    headers: { referer: LISTING, mhrParams: search },
  });
  if (!Array.isArray(body.results)) throw new Error('Chiltern search response has no results');
  if (body.results.length < body.search.total_rec) {
    throw new Error(`Chiltern has ${body.search.total_rec} vacancies but only ${body.results.length} fit on one page`);
  }
  return body.results.map((r) => ({
    externalId: r.vacancy_id,
    title: r.job_title.trim(),
    locationText: [r.location_id, r.region_id].filter(Boolean).join(', ') || null,
    url: `${BASE}/ETREC179GF.open?WVID=${WVID}&LANG=USA&VACANCY_ID=${r.vacancy_id}`,
    closingDate: r.app_close_d || null,
    salary: r.salary?.trim() || null,
  }));
}
