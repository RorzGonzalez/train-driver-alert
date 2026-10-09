import * as cheerio from 'cheerio';
import { ukDateToIso } from '../dates.js';
import { fetchText } from '../http.js';
import type { RawVacancy } from '../types.js';

// East Midlands Railway (its own ASP.NET jobs site). One server-rendered page
// with every external vacancy.
const BASE = 'https://jobs.eastmidlandsrailway.co.uk/';
const LIST = `${BASE}vacancies.aspx?cat=-1`;

export async function fetchEmr(): Promise<RawVacancy[]> {
  const $ = cheerio.load(await fetchText(LIST));
  const rows = $('div.vacancylistrow');
  if (rows.length === 0 && $('[class^="vacancylist"]').length === 0) throw new Error('EMR page has no vacancy list');
  const field = (row: cheerio.Cheerio<any>, label: string) =>
    row
      .find('div')
      .filter((_, d) => $(d).children('span').first().text().trim() === label)
      .first()
      .contents()
      .not('span')
      .text()
      .trim();
  return rows
    .map((_, el) => {
      const row = $(el);
      const a = row.find('a[href*="vacancy.aspx?ref="]').first();
      const ref = a.attr('href')?.match(/ref=([^&]+)/)?.[1] ?? '';
      return {
        externalId: ref,
        title: a.text().replace(/\s+/g, ' ').trim(),
        locationText: field(row, 'Location:') || null,
        url: `${BASE}vacancy.aspx?ref=${ref}`,
        closingDate: ukDateToIso(field(row, 'Closing Date:')),
        salary: field(row, 'Salary:') || null,
      };
    })
    .get();
}
