import * as cheerio from 'cheerio';
import { fetchText } from '../http.js';
import type { RawVacancy } from '../types.js';

// GB Railfreight (Eploy). Server-rendered HTML; GBRf calls its drivers
// "Train Manager", which companies.ts handles with a title override.
const BASE = 'https://careers.gbrailfreight.com/vacancies/';
const LIST = `${BASE}vacancy-search-results.aspx`;

export async function fetchGbrf(): Promise<RawVacancy[]> {
  const $ = cheerio.load(await fetchText(LIST));
  const total = Number($('title').text().match(/(\d+)\s+Vacanc/)?.[1]);
  if (Number.isNaN(total)) throw new Error('GBRf listing has no vacancy count in its title');
  const vacancies = $('div[id*="VacancyListView"][id$="_pnlList"]')
    .map((_, el) => {
      const a = $(el).find('h2.vsr-job__title a');
      const href = a.attr('href') ?? '';
      const field = (name: string) =>
        $(el).find(`li[id^="li_VacV_${name}_"] span[id$="_lblReadonlySelected"]`).text().replace(/\s+/g, ' ').trim();
      const closing = field('AdvertisingEndDate');
      return {
        externalId: href.split('/')[0] || href,
        title: a.text().replace(/\s+/g, ' ').trim(),
        locationText: field('AllLocations') || null,
        url: new URL(href, BASE).toString(),
        closingDate: closing && !/not specified/i.test(closing) ? closing : null,
      };
    })
    .get();
  if (vacancies.length < total) throw new Error(`GBRf has ${total} vacancies but only ${vacancies.length} were on the page`);
  return vacancies;
}
