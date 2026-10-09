import { fetchJson } from '../http.js';
import type { RawVacancy } from '../types.js';

// West Midlands Trains (Pinpoint). One JSON document with every posting.
const URL = 'https://wmtrains.pinpointhq.com/postings.json';

interface Posting {
  id: string;
  title: string;
  url: string;
  deadline_at: string | null;
  compensation: string | null;
  location: { name: string | null; city: string | null } | null;
}

export async function fetchWmt(): Promise<RawVacancy[]> {
  const body = await fetchJson<{ data: Posting[] }>(URL);
  if (!Array.isArray(body.data)) throw new Error('WMT postings.json has no data array');
  return body.data.map((p) => ({
    externalId: p.id,
    title: p.title.trim(),
    locationText: p.location?.name ?? p.location?.city ?? null,
    url: p.url,
    closingDate: p.deadline_at,
    salary: p.compensation?.trim() || null,
  }));
}
