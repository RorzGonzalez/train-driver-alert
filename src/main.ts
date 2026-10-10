import { companies } from './companies.js';
import { fetchBodyText } from './http.js';
import { runOnce } from './run.js';
import { loadState, saveState } from './state.js';
import { makeSender } from './telegram.js';

try {
  process.loadEnvFile('.env');
} catch {
  // no .env file, rely on the environment
}

const args = new Set(process.argv.slice(2));
const once = args.has('--once');
const dryRun = args.has('--dry-run');
const only = [...args].find((a) => a.startsWith('--only='))?.slice(7);
// QUIET keeps vacancy titles out of a log that anyone can read.
const quiet = process.env.QUIET === 'true';

const statePath = process.env.STATE_PATH ?? 'tmp/state.json';
const intervalMs = Number(process.env.INTERVAL_MINUTES ?? 60) * 60_000;

const log = (line: string) => console.log(`${new Date().toISOString()} ${line}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeNotifiers() {
  if (dryRun) {
    return {
      notify: async (html: string) => log(`DRY-RUN would send:\n${html}`),
      notifyAdmin: async (html: string) => log(`DRY-RUN would send to admin:\n${html}`),
    };
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required (or pass --dry-run)');
  const sendFamily = makeSender(token, chatId);
  const sendAdmin = makeSender(token, process.env.ADMIN_CHAT_ID ?? chatId);
  return {
    // Pause after each message so a busy run stays under Telegram's limit of about 20 a minute per group.
    notify: async (html: string) => {
      await sendFamily(html);
      await sleep(3100);
    },
    notifyAdmin: sendAdmin,
  };
}

async function tick(): Promise<void> {
  const state = loadState(statePath);
  const selected = only ? companies.filter((c) => c.slug === only) : companies;
  if (only && selected.length === 0) throw new Error(`No company with slug "${only}"`);
  const summary = await runOnce({
    companies: selected,
    state,
    now: () => new Date(),
    ...makeNotifiers(),
    fetchBodyText,
    log,
    trace: quiet ? () => {} : log,
  });
  if (!dryRun) saveState(statePath, state);
  log(`run complete: sent=${summary.sent} suppressed=${summary.suppressed} failed=${summary.failed.join(',') || 'none'}`);
}

async function main(): Promise<void> {
  if (once) {
    await tick();
    return;
  }
  log(`polling ${companies.length} companies every ${intervalMs / 60_000} minutes`);
  for (;;) {
    try {
      await tick();
    } catch (err) {
      log(`run crashed: ${(err as Error).stack ?? err}`);
    }
    await sleep(intervalMs);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
