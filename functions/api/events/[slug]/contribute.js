// POST /api/events/:slug/contribute — start a Paystack contribution to the pool.
// Amount is in the event's currency, MINOR units. Returns a checkout URL.

import { ok, fail, readJson } from '../../../_lib/respond.js'
import { uid, now, isEmail, clampStr } from '../../../_lib/util.js'
import * as paystack from '../../../_lib/paystack.js'

const MIN_MINOR = 500 // GH₵5 floor to deter spam/dust

export async function onRequestPost({ params, request, env }) {
  if (!paystack.isConfigured(env)) return fail('Payments are not configured', 503)

  const db = env.DB
  const event = await db
    .prepare('SELECT id, slug, currency, contributions_enabled FROM events WHERE slug = ? AND visibility != ?')
    .bind(params.slug, 'private')
    .first()
  if (!event) return fail('Event not found', 404)
  if (!event.contributions_enabled) return fail('Contributions are closed for this event', 403)

  const body = await readJson(request)
  const name = clampStr(body.name, 120)
  const email = clampStr(body.email, 160).toLowerCase()
  const amount = Math.round(Number(body.amount) || 0) // minor units, event currency
  const anonymous = body.anonymous ? 1 : 0

  if (!isEmail(email)) return fail('A valid email is required for your receipt', 422)
  if (amount < MIN_MINOR) return fail('Please enter a larger amount', 422)

  const reference = `GGC-${now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
  const site = env.SITE_URL || new URL(request.url).origin
  const callbackUrl = `${site}/api/paystack/callback?to=${encodeURIComponent('/e/' + event.slug)}`

  const tx = await paystack.initialize(env, {
    email,
    amount, // Paystack expects minor units (pesewas) — event currency is GHS
    reference,
    callbackUrl,
    metadata: { kind: 'contribution', eventId: event.id, slug: event.slug, name },
  })

  await db
    .prepare(
      `INSERT INTO contributions
       (id, event_id, name, email, amount, currency, message, anonymous, status, reference, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    )
    .bind(
      uid('con_'), event.id, name, email, amount, event.currency,
      clampStr(body.message, 500), anonymous, reference, now()
    )
    .run()

  return ok({ authorization_url: tx.authorization_url, reference })
}
