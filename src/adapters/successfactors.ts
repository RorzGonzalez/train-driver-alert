import * as cheerio from 'cheerio';
import { fetchText } from '../http.js';
import { extractPay } from '../pay.js';
import type { RawVacancy } from '../types.js';

// SuccessFactors career sites of the server-rendered kind share one search page:
// 25 rows a page, each cell repeated for phone and desktop, and the total in
// "Results 1 – 25 of 363". The closing date and pay are on the advert page.
const PAGE = 25;

export interface SuccessFactorsConfig {
  host: string;
  /** Query string of the search, without startrow. */
  search: string;
}

export function successFactors(cfg: SuccessFactorsConfig) {
  const base = `https://${cfg.host}`;

  async function fetch(): Promise<RawVacancy[]> {
    const all: RawVacancy[] = [];
    let total = Infinity;
    for (let startrow = 0; startrow < total; startrow += PAGE) {
      const $ = cheerio.load(await fetchText(`${base}/search/?${cfg.search}&startrow=${startrow}`));
      const count = Number($('.paginationLabel').first().text().match(/of\s+(\d+)/)?.[1]);
      if (Number.isNaN(count)) throw new Error(`${cfg.host}: listing has no result count`);
      total = count;
      const rows = $('tr.data-row');
      rows.each((_, el) => {
        const a = $(el).find('a.jobTitle-link').first();
        const loc = $(el).find('span.jobLocation').first();
        loc.find('small').remove(); // "+2 more…"
        const href = a.attr('href') ?? '';
        all.push({
          externalId: href.match(/\/(\d+)\/?$/)?.[1] ?? href,
          title: a.text().replace(/\s+/g, ' ').trim(),
          locationText: loc.text().replace(/\s+/g, ' ').trim() || null,
          url: base + href,
          closingDate: null,
        });
      });
      if (rows.length < PAGE) break;
    }
    if (all.length < total) throw new Error(`${cfg.host} lists ${total} jobs but only ${all.length} were read`);
    return all;
  }

  // A filled vacancy still returns a page, without these tags.
  async function enrich(v: RawVacancy): Promise<Partial<RawVacancy>> {
    const $ = cheerio.load(await fetchText(v.url));
    const until = $('meta[itemprop=validThrough]').attr('content') ?? '';
    const closingDate = Number.isNaN(Date.parse(until)) ? null : new Date(until).toISOString();
    const salary = extractPay($('[itemprop=description]').text() || $('span.jobdescription').text());
    return { ...(closingDate ? { closingDate } : {}), ...(salary ? { salary } : {}) };
  }

  return { fetch, enrich };
}
