import * as cheerio from 'cheerio';
import { fetchText } from '../http.js';
import type { RawVacancy } from '../types.js';

// Avanti West Coast (Volcanic). The JSON API is disallowed by robots.txt, so
// this reads the HTML listing, which shows up to 100 jobs on one page.
const LIST = 'https://www.careers.avantiwestcoast.co.uk/jobs';

export async function fetchAvanti(): Promise<RawVacancy[]> {
  const $ = cheerio.load(await fetchText(LIST));
  const found = Number($('#results-count-title').text().match(/Found\s+(\d+)/)?.[1]);
  if (Number.isNaN(found)) throw new Error('Avanti listing has no "Found N jobs" count');
  const vacancies = $('li.job-result-item')
    .map((_, el) => {
      const a = $(el).find('.job-title a');
      const href = a.attr('href') ?? '';
      const slug = href.split('/').pop() ?? href;
      return {
        externalId: slug.match(/-(\d+)$/)?.[1] ?? slug,
        title: a.text().trim(),
        locationText: $(el).find('.results-job-location').text().trim() || null,
        url: new URL(href, LIST).toString(),
        closingDate: null,
        salary: $(el).find('.results-salary').text().trim() || null,
      };
    })
    .get();
  if (vacancies.length < found) throw new Error(`Avanti lists ${found} jobs but only ${vacancies.length} were on the page`);
  return vacancies;
}

export async function enrichAvanti(v: RawVacancy): Promise<Partial<RawVacancy>> {
  const $ = cheerio.load(await fetchText(v.url));
  for (const el of $('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse($(el).text()) as { '@type'?: string; validThrough?: string };
      if (data['@type'] === 'JobPosting' && data.validThrough) return { closingDate: data.validThrough };
    } catch {
      // not the block we want
    }
  }
  return {};
}
