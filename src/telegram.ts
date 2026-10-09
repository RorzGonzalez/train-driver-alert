const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function makeSender(token: string, chatId: string) {
  return async function send(html: string): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML' }),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) return;
      const body = (await res.json().catch(() => ({}))) as { parameters?: { retry_after?: number }; description?: string };
      if (res.status === 429 && attempt === 0) {
        await sleep(((body.parameters?.retry_after ?? 5) + 1) * 1000);
        continue;
      }
      throw new Error(`Telegram ${res.status}: ${body.description ?? 'unknown error'}`);
    }
  };
}
