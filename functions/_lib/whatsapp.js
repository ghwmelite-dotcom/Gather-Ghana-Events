// WhatsApp Cloud API helpers. Env-gated; no-ops when unconfigured.

export const isConfigured = (env) => Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID)

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

// Simple intent router for inbound text.
export function reply(text, site) {
  const t = (text || '').trim().toLowerCase()
  if (/rsvp/.test(t)) return `To RSVP, open your invite link and tap RSVP. Need help? ${site}/contact`
  if (/pay|gift|contribut|deposit/.test(t)) return `You can send a gift or pay securely from the event page or your portal: ${site}/portal`
  if (/status|update|timeline/.test(t)) return `See your event timeline & payments in your client portal: ${site}/portal`
  if (/plan|book|quote|start/.test(t)) return `Let's plan your event! Start here: ${site}/book`
  return `Akwaaba! 🇬🇭 This is Gather Ghana Events.\n• "plan" — start planning\n• "rsvp" — RSVP to an event\n• "pay" — send a gift / pay\n• "status" — your event updates\nOr visit ${site}`
}
