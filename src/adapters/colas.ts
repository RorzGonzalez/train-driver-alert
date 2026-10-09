import * as cheerio from 'cheerio';
import { fetchText } from '../http.js';
import type { RawVacancy } from '../types.js';

// Colas Rail UK (SAP SuccessFactors, group-wide). The search API is disallowed
// by robots.txt, so this reads the group job feed (about 7 MB, so it is polled
// hourly) and keeps UK items in the Railways job function. The location field
// is often an office; the real base is usually in the title's parentheses.
const FEED = 'https://colas.jobs.hr.cloud.sap/sitemap.xml';

export async function fetchColas(): Promise<RawVacancy[]> {
  const $ = cheerio.load(await fetchText(FEED), { xml: true });
  const items = $('rss > channel > item');
  if (items.length === 0) throw new Error('Colas feed has no items');
  const vacancies: RawVacancy[] = [];
  items.each((_, el) => {
    const item = $(el);
    const location = item.find('g\\:location').text().trim();
    if (item.find('g\\:job_function').text().trim() !== 'Railways' || !/,\s*GB\b/.test(location)) return;
    // "Freight Train Driver (Dunbar) (SCOTLAND, GB, IV2 5EE)" -> title, base
    const title = item.find('title').text().replace(/\s*\([^()]*,\s*GB\b[^()]*\)\s*$/, '').trim();
    const base = title.match(/\(([^()]+)\)\s*$/)?.[1];
    const city = location.split(',')[0].trim();
    vacancies.push({
      externalId: item.find('g\\:id').text().trim() || item.find('guid').text().trim(),
      title,
      locationText: base ? `${base}, ${city}` : city,
      url: item.find('link').text().trim(),
      closingDate: null, // the feed's expiration date is a fixed 30 days, not a real closing date
    });
  });
  return vacancies;
}
