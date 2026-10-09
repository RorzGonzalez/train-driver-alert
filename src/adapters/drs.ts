import { ukDateToIso } from '../dates.js';
import { USER_AGENT } from '../http.js';
import type { RawVacancy } from '../types.js';

// Direct Rail Services recruits through the Nuclear Transport Solutions board
// (networx). The search call needs the session cookies, the anti-forgery token
// from the listing page, and a Referer; without the Referer it answers
// {"OK":false} with HTTP 200, so OK is checked and the count call is compared.
const HOST = 'https://nucleartransportsolutions.current-vacancies.com';
const LIST = `${HOST}/Careers/nucleartransportsolutions-vacancy-search-3204`;
const CLIENT_ID = 3204;

interface Row {
  VacancyID: string;
  VacancyTitle: string;
  Location: string | null;
  ApplyLink: string;
  ExpiryDate: string | null;
  /** Custom fields arrive as "<id>_Salary", "<id>_ContractType" and so on. */
  [field: string]: unknown;
}

function salaryOf(row: Row): string | null {
  const value = Object.entries(row).find(([key]) => key.endsWith('_Salary'))?.[1];
  return typeof value === 'string' ? value.trim() || null : null;
}

export async function fetchDrs(): Promise<RawVacancy[]> {
  const page = await fetch(LIST, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(25_000) });
  if (!page.ok) throw new Error(`HTTP ${page.status} for ${LIST}`);
  const cookies = page.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const token = (await page.text()).match(/__RequestVerificationToken" type="hidden" value="([^"]+)"/)?.[1];
  if (!token) throw new Error('NTS listing page has no request token');

  const data = JSON.stringify({
    ClientID: CLIENT_ID,
    OnboardingPageID: -111020,
    DynamicFields: [],
    SearchResultFields: [],
    CurrentPage: 1,
    PageSearchResults: true,
    SearchResultPageSize: 100,
    keywords: '',
    Locations: ['0'],
    'Salary_All Salaries': ['0'],
  });
  const post = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${HOST}/Careers/${path}`, {
      method: 'POST',
      headers: {
        'user-agent': USER_AGENT,
        cookie: cookies,
        referer: LIST,
        'x-requested-with': 'XMLHttpRequest',
        __RequestVerificationToken: token,
      },
      body: new URLSearchParams({ __RequestVerificationToken: token, data, hdnNewWorld: 'True' }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for NTS ${path}`);
    const body = (await res.json()) as T & { OK?: boolean };
    if (!body.OK) throw new Error(`NTS ${path} answered OK=false`);
    return body;
  };

  const [{ Data }, { Count }] = await Promise.all([post<{ Data: Row[] }>('SearchVacancies'), post<{ Count: number }>('SearchVacanciesCount')]);
  if (!Array.isArray(Data)) throw new Error('NTS search response has no Data');
  if (Data.length < Count) throw new Error(`NTS has ${Count} vacancies but only ${Data.length} were returned`);
  return Data.map((r) => ({
    externalId: r.VacancyID,
    title: r.VacancyTitle.replace(/[\^\s]+$/, '').replace(/\s+/g, ' ').trim(),
    locationText: r.Location?.trim() || null,
    url: r.ApplyLink,
    closingDate: ukDateToIso(r.ExpiryDate),
    salary: salaryOf(r),
  }));
}
