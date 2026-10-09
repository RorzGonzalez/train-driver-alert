import { bodyMentionsDriving, classifyFactoryTitle, classifyLocation, classifyTitle, isApprenticeship, type RoleDecision } from './classify.js';
import { belowPayFloor } from './pay.js';
import { escapeHtml } from './telegram.js';
import type { Company, RawVacancy } from './types.js';
import type { State } from './state.js';

export interface RunDeps {
  companies: Company[];
  state: State;
  now: () => Date;
  /** Family chat. */
  notify: (html: string) => Promise<void>;
  /** Scraper health, normally a private chat. */
  notifyAdmin: (html: string) => Promise<void>;
  fetchBodyText: (url: string) => Promise<string>;
  /** Per-company counts and failures. */
  log: (line: string) => void;
  /** Per-vacancy decisions; silenced where the log is public. */
  trace: (line: string) => void;
}

export interface RunSummary {
  sent: number;
  suppressed: number;
  failed: string[];
}

/** Consecutive failed fetches before the admin hears about it. */
export const FAILURES_BEFORE_ALERT = 3;
/** A vacancy unseen for this long counts as new if it reappears. */
export const DORMANT_DAYS = 30;

type FetchResult = { company: Company; vacancies: RawVacancy[] } | { company: Company; error: string };

export async function runOnce(deps: RunDeps): Promise<RunSummary> {
  const summary: RunSummary = { sent: 0, suppressed: 0, failed: [] };
  const due = deps.companies.filter((company) => isDue(deps, company));
  const results = await Promise.all(
    due.map(async (company): Promise<FetchResult> => {
      try {
        return { company, vacancies: await company.fetch() };
      } catch (err) {
        return { company, error: err instanceof Error ? err.message : String(err) };
      }
    }),
  );

  for (const result of results) {
    const { company } = result;
    if ('error' in result) {
      await recordFailure(deps, company, result.error);
      summary.failed.push(company.slug);
      continue;
    }
    await recordSuccess(deps, company);
    deps.state.lastFetched[company.slug] = deps.now().toISOString();
    let sent = 0;
    let suppressed = 0;
    for (const vacancy of result.vacancies) {
      const outcome = await handleVacancy(deps, company, vacancy);
      if (outcome === 'sent') sent++;
      if (outcome === 'suppressed') suppressed++;
    }
    deps.log(`${company.slug}: ${result.vacancies.length} vacancies, ${sent} sent, ${suppressed} suppressed`);
    summary.sent += sent;
    summary.suppressed += suppressed;
  }
  return summary;
}

function isDue(deps: RunDeps, company: Company): boolean {
  if (!company.pollEveryMinutes) return true;
  const last = deps.state.lastFetched[company.slug];
  if (!last) return true;
  return deps.now().getTime() - new Date(last).getTime() >= company.pollEveryMinutes * 60_000;
}

async function handleVacancy(
  deps: RunDeps,
  company: Company,
  vacancy: RawVacancy,
): Promise<'sent' | 'suppressed' | 'seen'> {
  const now = deps.now();
  const nowIso = now.toISOString();
  const key = `${company.slug}:${vacancy.externalId}`;
  const existing = deps.state.seen[key];
  if (existing) {
    const dormantMs = now.getTime() - new Date(existing.lastSeen).getTime();
    existing.lastSeen = nowIso;
    if (dormantMs < DORMANT_DAYS * 86_400_000) return 'seen';
    deps.trace(`${key}: reappeared after ${Math.round(dormantMs / 86_400_000)} days, treating as new`);
  }

  const { decision, vacancy: full } = await decide(deps, company, vacancy);
  deps.state.seen[key] = {
    firstSeen: existing?.firstSeen ?? nowIso,
    lastSeen: nowIso,
    title: full.title,
    location: full.locationText,
    url: full.url,
    sent: decision.send,
    reason: decision.reason,
  };
  if (!decision.send) {
    deps.trace(`${key}: suppressed (${decision.reason}) "${full.title}" @ ${full.locationText ?? '-'}`);
    return 'suppressed';
  }
  deps.trace(`${key}: SEND (${decision.reason}) "${full.title}" @ ${full.locationText ?? '-'}`);
  await deps.notify(formatVacancy(company, full, decision));
  return 'sent';
}

interface Decision {
  send: boolean;
  reason: string;
  role?: 'driver' | 'frontline' | 'factory' | 'possible' | 'unclassified';
  location?: 'in-range' | 'unclear';
}

async function enrich(deps: RunDeps, company: Company, vacancy: RawVacancy): Promise<RawVacancy> {
  if (!company.enrich) return vacancy;
  try {
    return { ...vacancy, ...(await company.enrich(vacancy)) };
  } catch (err) {
    deps.trace(`${company.slug}:${vacancy.externalId}: enrich failed (${(err as Error).message})`);
    return vacancy;
  }
}

async function decide(
  deps: RunDeps,
  company: Company,
  raw: RawVacancy,
): Promise<{ decision: Decision; vacancy: RawVacancy }> {
  let role: RoleDecision =
    company.category === 'factory' ? classifyFactoryTitle(raw.title)
    : company.driverTitles?.test(raw.title) ? { role: 'driver' }
    : classifyTitle(raw.title);
  if (role.role === 'frontline' && company.driverOnly) role = { role: 'unclassified' };
  if (role.role === null) return { decision: { send: false, reason: role.reason }, vacancy: raw };

  // Only now is a second request worth making: it can add the closing date and
  // the real locations behind a vague listing entry.
  const vacancy = await enrich(deps, company, raw);
  const location = classifyLocation(vacancy.locationText, company.inRange, vacancy.title);
  if (location === 'out-of-range') return { decision: { send: false, reason: 'out of range' }, vacancy };
  if (company.category === 'factory' && !isApprenticeship(vacancy.title) && belowPayFloor(vacancy.salary)) {
    return { decision: { send: false, reason: 'below pay floor' }, vacancy };
  }

  if (role.role !== 'unclassified') {
    return { decision: { send: true, reason: `${role.role} title`, role: role.role, location }, vacancy };
  }

  // Title did not settle it: read the advert. Fail open if the page cannot be read.
  try {
    const body = await deps.fetchBodyText(vacancy.url);
    if (bodyMentionsDriving(body)) {
      return { decision: { send: true, reason: 'advert mentions driving', role: 'possible', location }, vacancy };
    }
    return { decision: { send: false, reason: 'unclassified title, advert does not mention driving' }, vacancy };
  } catch (err) {
    deps.trace(`${company.slug}:${vacancy.externalId}: advert body unreadable (${(err as Error).message})`);
    return { decision: { send: true, reason: 'unclassified, advert unreadable', role: 'unclassified', location }, vacancy };
  }
}

export function formatVacancy(company: Company, v: RawVacancy, d: Decision): string {
  const lines = [
    d.role === 'frontline' ? '🎫 FRONTLINE' : d.role === 'factory' ? '🏭 FACTORY' : '🚆 DRIVER',
    `<b>${escapeHtml(v.title)}</b>`,
    `${escapeHtml(company.name)} · ${escapeHtml(v.locationText?.trim() || 'location not stated')}`,
  ];
  // "Competitive" and "Not Specified" are not pay.
  if (v.salary && /\d/.test(v.salary)) lines.push(`💷 ${escapeHtml(v.salary.trim())}`);
  if (v.closingDate) lines.push(`Closes ${formatDate(v.closingDate)}`);
  if (d.role === 'possible') lines.push('⚠️ Title is not explicit, but the advert mentions train driving');
  if (d.role === 'unclassified') lines.push('⚠️ Could not read the advert to confirm this is a driver role');
  if (d.location === 'unclear' && v.locationText) lines.push('📍 Location is vague, check it is in range');
  lines.push(`<a href="${escapeHtml(v.url)}">Open advert</a>`);
  return lines.join('\n');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' });
}

async function recordFailure(deps: RunDeps, company: Company, error: string): Promise<void> {
  const f = (deps.state.failures[company.slug] ??= { count: 0, notified: false });
  f.count++;
  deps.log(`${company.slug}: FAILED (${f.count}) ${error}`);
  if (f.count >= FAILURES_BEFORE_ALERT && !f.notified) {
    f.notified = true;
    await deps.notifyAdmin(
      `⚠️ ${escapeHtml(company.name)} has failed ${f.count} checks in a row.\n<code>${escapeHtml(error.slice(0, 300))}</code>`,
    );
  }
}

async function recordSuccess(deps: RunDeps, company: Company): Promise<void> {
  const f = deps.state.failures[company.slug];
  if (!f) return;
  if (f.notified) await deps.notifyAdmin(`✅ ${escapeHtml(company.name)} is being read again.`);
  delete deps.state.failures[company.slug];
}
