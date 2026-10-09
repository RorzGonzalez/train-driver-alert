import { describe, expect, it, vi } from 'vitest';
import { DORMANT_DAYS, FAILURES_BEFORE_ALERT, runOnce, type RunDeps } from '../src/run.js';
import { emptyState } from '../src/state.js';
import type { Company, RawVacancy } from '../src/types.js';


const vacancy = (over: Partial<RawVacancy> = {}): RawVacancy => ({
  externalId: '1',
  title: 'Trainee Train Driver',
  locationText: 'Banbury',
  url: 'https://example.com/jobs/1',
  closingDate: '2026-10-20',
  ...over,
});

function makeDeps(companies: Company[], over: Partial<RunDeps> = {}): RunDeps & { sent: string[]; admin: string[] } {
  const sent: string[] = [];
  const admin: string[] = [];
  return {
    companies,
    state: emptyState(),
    now: () => new Date('2026-10-09T09:00:00Z'),
    notify: async (html) => {
      sent.push(html);
    },
    notifyAdmin: async (html) => {
      admin.push(html);
    },
    fetchBodyText: async () => '',
    log: () => {},
    trace: () => {},
    sent,
    admin,
    ...over,
  };
}

const company = (fetch: Company['fetch'], over: Partial<Company> = {}): Company => ({
  slug: 'chiltern',
  name: 'Chiltern Railways',
  inRange: ['banbury', 'birmingham'],
  fetch,
  ...over,
});

describe('runOnce', () => {
  it('sends one message for a new driver vacancy and none the second time', async () => {
    const deps = makeDeps([company(async () => [vacancy()])]);
    const first = await runOnce(deps);
    expect(first.sent).toBe(1);
    expect(deps.sent[0].startsWith('🚆 DRIVER\n<b>Trainee Train Driver</b>')).toBe(true);
    expect(deps.sent[0]).toContain('Chiltern Railways · Banbury');
    expect(deps.sent[0]).toContain('Closes 20 Oct 2026');
    expect(deps.sent[0]).toContain('https://example.com/jobs/1');

    const second = await runOnce(deps);
    expect(second.sent).toBe(0);
    expect(deps.sent).toHaveLength(1);
  });

  it('records a suppressed vacancy without sending', async () => {
    const deps = makeDeps([company(async () => [vacancy({ title: 'Finance Business Partner' })])]);
    const summary = await runOnce(deps);
    expect(summary).toMatchObject({ sent: 0, suppressed: 1 });
    expect(deps.state.seen['chiltern:1']).toMatchObject({ sent: false, reason: 'other role' });
  });

  it('sends a frontline vacancy with its label and pay, and drops one out of range', async () => {
    const deps = makeDeps([
      company(async () => [
        vacancy({ externalId: 'near', title: 'Dispatcher', locationText: 'Banbury', salary: '£30,054.16' }),
        vacancy({ externalId: 'far', title: 'Dispatcher', locationText: 'Marylebone, London', salary: '£30,054.16' }),
      ]),
    ]);
    const summary = await runOnce(deps);
    expect(summary).toMatchObject({ sent: 1, suppressed: 1 });
    expect(deps.sent[0].startsWith('🎫 FRONTLINE\n<b>Dispatcher</b>\nChiltern Railways · Banbury\n💷 £30,054.16\n')).toBe(true);
    expect(deps.state.seen['chiltern:near']).toMatchObject({ sent: true, reason: 'frontline title' });
    expect(deps.state.seen['chiltern:far']).toMatchObject({ sent: false, reason: 'out of range' });
  });

  it('shows pay only when the site states a figure', async () => {
    const deps = makeDeps([
      company(async () => [
        vacancy({ externalId: 'a', salary: 'Competitive' }),
        vacancy({ externalId: 'b', salary: null }),
        vacancy({ externalId: 'c', salary: 'Up to £30,000' }),
      ]),
    ]);
    await runOnce(deps);
    expect(deps.sent[0]).not.toContain('💷');
    expect(deps.sent[1]).not.toContain('💷');
    expect(deps.sent[2]).toContain('💷 Up to £30,000');
  });

  it('drops a driver role at an out-of-range depot but keeps a vague one', async () => {
    const deps = makeDeps([
      company(async () => [
        vacancy({ externalId: 'far', locationText: 'Aylesbury' }),
        vacancy({ externalId: 'vague', locationText: 'Various' }),
        vacancy({ externalId: 'none', locationText: null }),
      ]),
    ]);
    const summary = await runOnce(deps);
    expect(summary).toMatchObject({ sent: 2, suppressed: 1 });
    expect(deps.sent[0]).toContain('Location is vague');
    expect(deps.sent[1]).toContain('location not stated');
  });

  it('reads the advert for an unclassified title', async () => {
    const fetchBodyText = vi.fn(async (url: string) =>
      url.endsWith('/yes') ? 'You will train to become a train driver.' : 'Nothing to do with driving.',
    );
    const deps = makeDeps(
      [
        company(async () => [
          vacancy({ externalId: 'yes', title: 'Rail Operations Trainee', url: 'https://example.com/yes' }),
          vacancy({ externalId: 'no', title: 'Rail Operations Trainee', url: 'https://example.com/no' }),
        ]),
      ],
      { fetchBodyText },
    );
    const summary = await runOnce(deps);
    expect(summary).toMatchObject({ sent: 1, suppressed: 1 });
    expect(deps.sent[0]).toContain('advert mentions train driving');
    expect(fetchBodyText).toHaveBeenCalledTimes(2);
  });

  it('still sends an unclassified vacancy when the advert cannot be read', async () => {
    const deps = makeDeps([company(async () => [vacancy({ title: 'Rail Operations Trainee' })])], {
      fetchBodyText: async () => {
        throw new Error('HTTP 403');
      },
    });
    const summary = await runOnce(deps);
    expect(summary.sent).toBe(1);
    expect(deps.sent[0]).toContain('Could not read the advert');
  });

  it('does not fetch adverts for titles that settle the question', async () => {
    const fetchBodyText = vi.fn(async () => '');
    const deps = makeDeps([company(async () => [vacancy(), vacancy({ externalId: '2', title: 'Train Cleaner' })])], {
      fetchBodyText,
    });
    await runOnce(deps);
    expect(fetchBodyText).not.toHaveBeenCalled();
  });

  it('tells the admin after repeated failures, once, and again on recovery', async () => {
    let fail = true;
    const deps = makeDeps([
      company(async () => {
        if (fail) throw new Error('HTTP 503');
        return [];
      }),
    ]);
    for (let i = 0; i < FAILURES_BEFORE_ALERT + 2; i++) {
      const summary = await runOnce(deps);
      expect(summary.failed).toEqual(['chiltern']);
    }
    expect(deps.admin).toHaveLength(1);
    expect(deps.admin[0]).toContain('Chiltern Railways');
    expect(deps.admin[0]).toContain('HTTP 503');
    expect(deps.sent).toHaveLength(0);

    fail = false;
    await runOnce(deps);
    expect(deps.admin).toHaveLength(2);
    expect(deps.admin[1]).toContain('being read again');
    expect(deps.state.failures.chiltern).toBeUndefined();
  });

  it('stays quiet about a single failed check', async () => {
    const deps = makeDeps([
      company(async () => {
        throw new Error('timeout');
      }),
    ]);
    await runOnce(deps);
    expect(deps.admin).toHaveLength(0);
  });

  it('keeps other companies going when one fails', async () => {
    const deps = makeDeps([
      company(async () => {
        throw new Error('down');
      }),
      company(async () => [vacancy()], { slug: 'wmt', name: 'West Midlands Trains', inRange: ['banbury'] }),
    ]);
    const summary = await runOnce(deps);
    expect(summary).toMatchObject({ sent: 1, failed: ['chiltern'] });
  });

  it('treats a vacancy that reappears after a long gap as new', async () => {
    let now = new Date('2026-10-09T09:00:00Z');
    const deps = makeDeps([company(async () => [vacancy()])], { now: () => now });
    await runOnce(deps);
    now = new Date(now.getTime() + (DORMANT_DAYS + 1) * 86_400_000);
    await runOnce(deps);
    expect(deps.sent).toHaveLength(2);
    expect(deps.state.seen['chiltern:1'].firstSeen).toBe('2026-10-09T09:00:00.000Z');
  });
});

describe('company-specific behaviour', () => {
  it('accepts a company title override that the generic classifier would drop', async () => {
    const deps = makeDeps([
      company(async () => [vacancy({ title: 'Trainee Train Manager - West Midlands (Talent Pool)', locationText: 'Bescot' })], {
        slug: 'gbrf',
        inRange: ['bescot'],
        driverTitles: /\btrain manager\b/i,
      }),
    ]);
    const summary = await runOnce(deps);
    expect(summary.sent).toBe(1);
  });

  it('treats a frontline word in a news headline as unclassified for a driver-only company', async () => {
    const fetchBodyText = vi.fn(async () => 'A new platform opened at Stourbridge Junction today.');
    const deps = makeDeps(
      [company(async () => [vacancy({ title: 'New Platform Opens', locationText: 'Stourbridge' })], { slug: 'pre-metro', inRange: ['stourbridge'], driverOnly: true })],
      { fetchBodyText },
    );
    const summary = await runOnce(deps);
    expect(summary).toMatchObject({ sent: 0, suppressed: 1 });
    expect(fetchBodyText).toHaveBeenCalledTimes(1);
  });

  it('matches an in-range depot named only in the title', async () => {
    const deps = makeDeps([company(async () => [vacancy({ title: 'Train Driver - Birmingham', locationText: 'Not Specified' })])]);
    expect((await runOnce(deps)).sent).toBe(1);
  });

  it('enriches a new vacancy before deciding on its location, and only for titles that pass', async () => {
    const enrich = vi.fn(async (v: RawVacancy) => ({
      closingDate: '2026-10-30',
      locationText: v.externalId === 'two' ? 'Doncaster, Banbury' : 'Doncaster',
    }));
    const deps = makeDeps([
      company(
        async () => [
          vacancy({ externalId: 'two', locationText: '2 Locations' }),
          vacancy({ externalId: 'one', locationText: '2 Locations' }),
          vacancy({ externalId: 'other', title: 'Finance Business Partner', locationText: '2 Locations' }),
        ],
        { enrich },
      ),
    ]);
    const summary = await runOnce(deps);
    expect(summary).toMatchObject({ sent: 1, suppressed: 2 });
    expect(enrich).toHaveBeenCalledTimes(2);
    expect(deps.sent[0]).toContain('Doncaster, Banbury');
    expect(deps.sent[0]).toContain('Closes 30 Oct 2026');
    expect(deps.state.seen['chiltern:one']).toMatchObject({ reason: 'out of range', location: 'Doncaster' });
  });

  it('still sends when enrichment fails', async () => {
    const deps = makeDeps([
      company(async () => [vacancy()], {
        enrich: async () => {
          throw new Error('HTTP 403');
        },
      }),
    ]);
    expect((await runOnce(deps)).sent).toBe(1);
  });

  it('polls a slow company only when its interval has passed', async () => {
    const fetch = vi.fn(async () => [vacancy()]);
    let now = new Date('2026-10-09T09:00:00Z');
    const deps = makeDeps([company(fetch, { pollEveryMinutes: 60 })], { now: () => now });
    await runOnce(deps);
    now = new Date('2026-10-09T09:15:00Z');
    await runOnce(deps);
    expect(fetch).toHaveBeenCalledTimes(1);
    now = new Date('2026-10-09T10:00:00Z');
    await runOnce(deps);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
