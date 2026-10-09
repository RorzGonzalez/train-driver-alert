import * as cheerio from 'cheerio';
import { fetchText } from '../http.js';
import type { RawVacancy } from '../types.js';

// Staffline's search for Coleshill, the town Hams Hall sits in. Staffline does
// not name its clients in the listing, so each advert is read and kept only
// when its text names Hams Hall or BMW.
const BASE = 'https://www.staffline.co.uk';
const LIST = `${BASE}/jobs?keywords=&location=Coleshill`;
const SITE = /hams hall|\bbmw\b/i;

export async function fetchStaffline(): Promise<RawVacancy[]> {
  const $ = cheerio.load(await fetchText(LIST));
  if ($('form[action="/jobs"]').length === 0) throw new Error('Staffline search page did not render');
  const cards = $('div.job-card')
    .map((_, el) => {
      const href = $(el).find('a[href^="/job/"]').first().attr('href') ?? '';
      return {
        externalId: href.match(/\/job\/(\d+)/)?.[1] ?? href,
        title: $(el).find('h3.job-title').text().replace(/\s+/g, ' ').trim(),
        locationText: $(el).find('img.location-image').parent().text().replace(/\s+/g, ' ').trim() || null,
        url: BASE + href,
        closingDate: null,
        salary: $(el).find('.job-meta .badge').filter((_, b) => $(b).text().includes('£')).first().text().trim() || null,
      };
    })
    .get();
  const kept: RawVacancy[] = [];
  for (const card of cards) {
    if (SITE.test(await advertText(card.url))) kept.push(card);
  }
  return kept;
}

// The advert without its "similar jobs" strip, which could name the site for another job.
async function advertText(url: string): Promise<string> {
  const $ = cheerio.load(await fetchText(url));
  $('script, style, .similar-jobs').remove();
  return $('body').text().replace(/\s+/g, ' ');
}
