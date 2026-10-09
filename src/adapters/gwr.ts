import * as cheerio from 'cheerio';
import { fetchText } from '../http.js';
import type { RawVacancy } from '../types.js';

// Great Western Railway (Clinch, on FirstGroup's careers site). Server-rendered
// table filtered to the GWR company; the closing date is on the detail page.
const LIST = 'https://careers.firstgroup.co.uk/jobs/search?dropdown_field_1_uids%5B%5D=71bafefefc716cc8046e1a3a35f7e860&per_page=100';

/** "Displaying 1 entry" or "Displaying all 5 entries" -> the entry count. */
export function countFromText(text: string): number | null {
  const numbers = text.match(/\d+/g);
  return numbers ? Number(numbers[numbers.length - 1]) : null;
}

export async function fetchGwr(): Promise<RawVacancy[]> {
  const $ = cheerio.load(await fetchText(LIST));
  const count = countFromText($('div.table-counts').text());
  if (count === null) throw new Error('GWR listing has no result count');
  const vacancies = $('tr[data-job-url]')
    .map((_, el) => {
      const url = $(el).attr('data-job-url') ?? '';
      const places = $(el).find('td.job-search-results-location li').map((_, li) => $(li).text().trim()).get();
      return {
        externalId: url.split('/').pop() || url,
        title: $(el).find('td.job-search-results-title a').text().replace(/\s+/g, ' ').trim(),
        locationText: places.join(', ') || null,
        url,
        closingDate: null,
        salary: $(el).find('td.job-search-results-dropdown_field_2').text().trim() || null,
      };
    })
    .get();
  if (vacancies.length < count) throw new Error(`GWR lists ${count} jobs but only ${vacancies.length} were on the page`);
  return vacancies;
}

export async function enrichGwr(v: RawVacancy): Promise<Partial<RawVacancy>> {
  const $ = cheerio.load(await fetchText(v.url));
  const closing = $('li.job-component-closing-on span').text().replace(/closing on:?/i, '').trim();
  return closing ? { closingDate: closing } : {};
}
