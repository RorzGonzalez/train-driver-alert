import * as cheerio from 'cheerio';

export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 train-driver-alert/1.0';

export async function fetchText(url: string, init: RequestInit = {}): Promise<string> {
  const res = await fetch(url, {
    ...init,
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/json;q=0.9,*/*;q=0.8', ...init.headers },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

export async function fetchJson<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const text = await fetchText(url, { ...init, headers: { accept: 'application/json', ...init.headers } });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Non-JSON response from ${url}: ${text.slice(0, 120)}`);
  }
}

/** Visible text of a page, for the advert-body check. */
export async function fetchBodyText(url: string): Promise<string> {
  const html = await fetchText(url);
  const $ = cheerio.load(html);
  $('script, style, noscript').remove();
  return $('body').text().replace(/\s+/g, ' ');
}
