import * as cheerio from 'cheerio';
import { fetchText } from '../http.js';
import type { RawVacancy } from '../types.js';

// Randstad's Jaguar Land Rover microsite: one server-rendered page of
// schema.org JobPosting articles with the pay in the markup.
const BASE = 'https://ourclients.randstad.co.uk';
const LIST = `${BASE}/jaguar-land-rover/vacancies/`;

export async function fetchRandstadJlr(): Promise<RawVacancy[]> {
  const $ = cheerio.load(await fetchText(LIST));
  const count = Number($('[id$=NrOfJobsLabel]').text().match(/of\s+(\d+)/)?.[1]);
  if (Number.isNaN(count)) throw new Error('Randstad JLR page has no job count');
  const vacancies = $('article[itemtype*="JobPosting"]')
    .map((_, el) => {
      const href = $(el).find('a[href*="job-details"]').first().attr('href') ?? '';
      const places = [$(el).find('[itemprop=addressLocality]').text().trim(), $(el).find('[itemprop=addressRegion]').text().trim()];
      return {
        externalId: href.match(/[?&]id=(\d+)/)?.[1] ?? href,
        title: $(el).find('[itemprop=title]').text().replace(/\s+/g, ' ').trim(),
        locationText: places.filter(Boolean).join(', ') || null,
        url: new URL(href, BASE).href,
        closingDate: null,
        salary: $(el).find('[id$=_SalaryLabel]').text().replace(/£\s+/g, '£').replace(/\s+/g, ' ').trim() || null,
      };
    })
    .get();
  if (vacancies.length < count) throw new Error(`Randstad JLR lists ${count} jobs but only ${vacancies.length} were on the page`);
  return vacancies;
}
