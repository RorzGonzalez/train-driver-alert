import * as cheerio from 'cheerio';
import { fetchJson } from '../http.js';
import type { RawVacancy } from '../types.js';

// Pre-Metro Operations has no careers page or recruitment system. Its only
// channel is WordPress news posts, so each post is treated as a possible
// advert. Its drivers are titled "Driver/CSO" (customer service officer), so a
// post about CSOs is labelled as a driver post for the classifier.
const POSTS = 'https://premetro.co.uk/wp-json/wp/v2/posts?per_page=20&_fields=id,date,link,title,excerpt';

interface WpPost {
  id: number;
  date: string;
  link: string;
  title: { rendered: string };
  excerpt: { rendered: string };
}

export async function fetchPreMetro(): Promise<RawVacancy[]> {
  const posts = await fetchJson<WpPost[]>(POSTS);
  if (!Array.isArray(posts)) throw new Error('Pre-Metro posts response is not a list');
  return posts.map((post) => {
    const title = cheerio.load(post.title.rendered).text().trim();
    const excerpt = cheerio.load(post.excerpt.rendered).text();
    const mentionsCso = /\bcso\b|customer service officer/i.test(`${title} ${excerpt}`);
    return {
      externalId: String(post.id),
      title: mentionsCso ? `${title} (Driver/CSO)` : title,
      locationText: 'Stourbridge',
      url: post.link,
      closingDate: null,
    };
  });
}
