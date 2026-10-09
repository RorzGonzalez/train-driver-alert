// Prints the chats the bot has seen, so the ids can go into TELEGRAM_CHAT_ID
// (the family group) and ADMIN_CHAT_ID (your private chat with the bot).
// Telegram only reports a chat once the bot has seen something in it: add the
// bot to the group and post "/start@<botname>" there; open the bot privately
// and press Start.
try {
  process.loadEnvFile('.env');
} catch {
  // no .env file, rely on the environment
}
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required: put TELEGRAM_BOT_TOKEN=... in .env or the environment');

interface Chat {
  id: number;
  type: string;
  title?: string;
  first_name?: string;
  username?: string;
}
interface Update {
  message?: { chat: Chat };
  my_chat_member?: { chat: Chat };
  channel_post?: { chat: Chat };
}

const api = (method: string) => fetch(`https://api.telegram.org/bot${token}/${method}`).then((r) => r.json());

const me = (await api('getMe')) as { ok: boolean; result?: { username: string }; description?: string };
if (!me.ok) throw new Error(`Telegram rejected the token: ${me.description}`);
console.log(`Bot: @${me.result?.username}`);

const hook = (await api('getWebhookInfo')) as { result?: { url?: string } };
if (hook.result?.url) {
  console.log(`A webhook is set (${hook.result.url}); removing it so updates can be read here.`);
  await api('deleteWebhook');
}

const updates = (await api('getUpdates?allowed_updates=%5B%22message%22%2C%22my_chat_member%22%2C%22channel_post%22%5D')) as {
  ok: boolean;
  result?: Update[];
  description?: string;
};
if (!updates.ok) throw new Error(`Telegram: ${updates.description}`);

const chats = new Map<number, Chat>();
for (const u of updates.result ?? []) {
  const chat = u.message?.chat ?? u.my_chat_member?.chat ?? u.channel_post?.chat;
  if (chat) chats.set(chat.id, chat);
}
console.log(`Telegram returned ${updates.result?.length ?? 0} updates covering ${chats.size} chats.`);
if (chats.size === 0) {
  console.log(`Nothing seen yet. In the family group post:  /start@${me.result?.username}`);
  console.log('For the admin chat, open the bot in Telegram and press Start. Then run this again.');
}
for (const c of chats.values()) {
  const label = c.type === 'private' ? 'ADMIN_CHAT_ID candidate' : 'TELEGRAM_CHAT_ID candidate';
  console.log(`${c.id}\t${c.type}\t${c.title ?? c.first_name ?? c.username ?? ''}\t(${label})`);
}
