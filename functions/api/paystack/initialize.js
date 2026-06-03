// POST /api/paystack/initialize — start a payment for the signed-in client.
// Used by the portal to pay an outstanding balance. Amount is server-validated
// against the inquiry so the client can't choose an arbitrary figure.

import { ok, fail, readJson } from '../../_lib/respond.js'
import { uid, now } from '../../_lib/util.js'
import { currentClientId } from '../../_lib/auth.js'
import * as paystack from '../../_lib/paystack.js'

export async function onRequestPost({ request, env }) {
  if (!paystack.isConfigured(env)) return fail('Payments are not configured', 503)

  const clientId = await currentClientId(request, env)
  if (!clientId) return fail('Not signed in', 401)

  const db = env.DB
  const client = await db
    .prepare('SELECT id, email FROM clients WHERE id = ?')
    .bind(clientId)
    .first()
  if (!client) return fail('Not signed in', 401)

  const body = await readJson(request)
  const inquiry = await db
    .prepare(
      `SELECT id, estimate, deposit FROM inquiries
       WHERE client_id = ? ORDER BY created_at DESC LIMIT 1`
    )
    .bind(clientId)
    .first()
  if (!inquiry) return fail('No event found to pay for', 404)

  // Outstanding balance (cedis) from successful payments so far.
  const paid = await db
    .prepare(
      "SELECT COALESCE(SUM(amount),0) AS p FROM payments WHERE inquiry_id = ? AND status = 'success'"
    )
    .bind(inquiry.id)
    .first()
  const paidCedis = Math.round((paid?.p || 0) / 100)
  const outstanding = Math.max(0, (inquiry.estimate || 0) - paidCedis)

  // Requested amount clamped to what is actually owed.
  const requested = Math.max(0, parseInt(body.amount) || outstanding)
  const amountCedis = Math.min(requested, outstanding)
  if (amountCedis <= 0) return fail('Nothing left to pay — you are all settled.', 400)

  const reference = `GGE-${now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
  const callbackUrl = `${env.SITE_URL || new URL(request.url).origin}/api/paystack/callback`

  const tx = await paystack.initialize(env, {
    email: client.email,
    amount: amountCedis * 100,
    reference,
    callbackUrl,
    metadata: { inquiryId: inquiry.id, clientId, purpose: body.purpose || 'balance' },
  })

  await db
    .prepare(
      `INSERT INTO payments
       (id, inquiry_id, client_id, reference, amount, currency, status, purpose, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    )
    .bind(
      uid('pay_'),
      inquiry.id,
      clientId,
      reference,
      amountCedis * 100,
      env.PAYSTACK_CURRENCY || 'GHS',
      body.purpose || 'balance',
      now()
    )
    .run()

  return ok({ authorization_url: tx.authorization_url, reference })
}
