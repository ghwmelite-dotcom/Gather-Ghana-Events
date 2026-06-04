// WhatsApp Cloud API helpers. Env-gated; no-ops when unconfigured.
// (Held off for now — kept ready. Telegram is the active chat channel.)

import { intentReply } from './messaging.js'

export const isConfigured = (env) => Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID)
export const reply = intentReply

export async function sendText(env, to, body) {
  if (!isConfigured(env)) return false
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
    })
    return res.ok
  } catch {
    return false
  }
}
