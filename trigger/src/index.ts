// Starts the poll workflow on GitHub every hour. GitHub's own cron never
// delivered a tick to this repository, so the schedule lives here instead.
// Secrets: GITHUB_TOKEN (fine-grained, Actions read and write on the one repo);
// TELEGRAM_BOT_TOKEN and ADMIN_CHAT_ID, optional, to report a refused dispatch.

const DISPATCH = 'https://api.github.com/repos/RorzGonzalez/train-driver-alert/actions/workflows/poll.yml/dispatches';

interface Secrets {
  GITHUB_TOKEN: string;
  TELEGRAM_BOT_TOKEN?: string;
  ADMIN_CHAT_ID?: string;
}

export default {
  async scheduled(_controller: ScheduledController, env: Secrets): Promise<void> {
    const res = await fetch(DISPATCH, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.GITHUB_TOKEN}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'train-driver-alert-trigger',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' }),
    });
    if (res.status === 204) return;
    const detail = `GitHub refused the dispatch: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`;
    console.error(detail);
    if (env.TELEGRAM_BOT_TOKEN && env.ADMIN_CHAT_ID) {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: env.ADMIN_CHAT_ID, text: `⚠️ Poll trigger: ${detail}` }),
      });
    }
  },
};
