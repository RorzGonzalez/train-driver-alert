import { fetchJson } from '../http.js';
import type { RawVacancy } from '../types.js';

// DB Cargo UK (ConnectATS). The careers page is a JavaScript app, but the JSON
// it loads is open.
const API = 'https://backend.connectats.com/api/v1/open/job/jobs/7632';

interface Job {
  jobId: number;
  title: string;
  location: string | null;
  endDate: string | null;
  salary: string | null;
}

export async function fetchDbCargo(): Promise<RawVacancy[]> {
  const jobs = await fetchJson<Job[]>(API);
  if (!Array.isArray(jobs)) throw new Error('DB Cargo jobs response is not a list');
  return jobs.map((j) => ({
    externalId: String(j.jobId),
    title: j.title.trim(),
    locationText: j.location?.trim() || null,
    url: `https://dbcargo.connectats.com/careers/jobs/${j.jobId}`,
    closingDate: j.endDate,
    salary: j.salary?.trim() || null,
  }));
}
