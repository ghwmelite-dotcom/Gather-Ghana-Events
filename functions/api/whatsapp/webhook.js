// WhatsApp Cloud API webhook.
//   GET  — verification handshake (hub.challenge)
//   POST — inbound messages → intent reply
// Fully env-gated: deploys now, activates when WHATSAPP_* secrets are set.

import { sendText, reply, isConfigured } from '../../_lib/whatsapp.js'

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')
  if (mode === 'subscribe' && token && token === env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge || '', { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

export async function onRequestPost({ request, env }) {
  // Always 200 quickly so WhatsApp doesn't retry.
  const site = env.SITE_URL || new URL(request.url).origin
  try {
    const payload = await request.json()
    const msg = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
    if (msg && isConfigured(env)) {
      const from = msg.from
      const text = msg.text?.body || ''
      await sendText(env, from, reply(text, site))
    }
  } catch {
    /* ignore malformed */
  }
  return new Response('ok', { status: 200 })
}
