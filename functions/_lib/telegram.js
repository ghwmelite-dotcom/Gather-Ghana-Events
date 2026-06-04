// Telegram Bot API helpers. Env-gated by TELEGRAM_BOT_TOKEN.
// Setup: create a bot via @BotFather, then point its webhook at
//   https://<site>/api/telegram/webhook   (optionally with a secret token).

export const isConfigured = (env) => Boolean(env.TELEGRAM_BOT_TOKEN)

export async function sendMessage(env, chatId, text) {
  if (!isConfigured(env)) return false
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: false }),
    })
    return res.ok
  } catch {
    return false
  }
}
