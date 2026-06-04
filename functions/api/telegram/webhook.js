// POST /api/telegram/webhook — Telegram bot updates → intent reply.
// Env-gated: deploys now, activates when TELEGRAM_BOT_TOKEN is set and the
// webhook is registered. Optional TELEGRAM_SECRET validates the request header.

import { sendMessage, isConfigured } from '../../_lib/telegram.js'
import { intentReply } from '../../_lib/messaging.js'

export async function onRequestPost({ request, env }) {
  const site = env.SITE_URL || new URL(request.url).origin

  if (env.TELEGRAM_SECRET) {
    const got = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
    if (got !== env.TELEGRAM_SECRET) return new Response('forbidden', { status: 403 })
  }

  try {
    const update = await request.json()
    const msg = update.message || update.edited_message || update.channel_post
    const chatId = msg?.chat?.id
    const text = msg?.text || ''
    if (chatId && isConfigured(env)) {
      await sendMessage(env, chatId, intentReply(text, site))
    }
  } catch {
    /* ignore malformed update */
  }
  return new Response('ok', { status: 200 })
}
