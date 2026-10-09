import * as cheerio from 'cheerio';
import { fetchText } from '../http.js';
import type { RawVacancy } from '../types.js';

// Govia Thameslink Railway (eArcu). The listing page sits behind an AWS WAF
// challenge, but the RSS feed is open. Location comes from the "County:" prefix
// of the description; the feed carries no closing date.
const FEED = 'https://www.gtrailwaycareers.com/jobs/rss/';

export async function fetchGtr(): Promise<RawVacancy[]> {
  const xml = await fetchText(FEED);
  const $ = cheerio.load(xml, { xml: true });
  if ($('rss > channel').length === 0) throw new Error('GTR feed is not RSS');
  return $('item')
    .map((_, el) => {
      const link = $(el).find('link').text().trim();
      const externalId = link.match(/\/(\d+)\/description\/?$/)?.[1] ?? link;
      const title = $(el).find('title').text().replace(/\s*\(\d+\)\s*$/, '').replace(/\s+/g, ' ').trim();
      const county = $(el).find('description').text().match(/County:\s*([^,<]+)/)?.[1]?.trim() ?? null;
      return { externalId, title, locationText: county, url: link, closingDate: null };
    })
    .get();
}
