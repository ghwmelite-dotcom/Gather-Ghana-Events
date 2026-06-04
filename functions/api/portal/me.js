// GET /api/portal/me — the signed-in client's events, payments, and timeline.

import { json, unauthorized } from '../../_lib/respond.js'
import { currentClientId } from '../../_lib/auth.js'
import { escrowTotals } from '../../_lib/escrow.js'

export async function onRequestGet({ request, env }) {
  const clientId = await currentClientId(request, env)
  if (!clientId) return unauthorized()
  const db = env.DB

  const client = await db
    .prepare('SELECT id, email, name, phone FROM clients WHERE id = ?')
    .bind(clientId)
    .first()
  if (!client) return unauthorized()

  const { results: inquiries } = await db
    .prepare(
      `SELECT id, event_type, event_date, guests, estimate, deposit, notes, status, created_at
       FROM inquiries WHERE client_id = ? ORDER BY created_at DESC`
    )
    .bind(clientId)
    .all()

  // The "current" event is the most recent inquiry.
  const primary = inquiries[0] || null

  let timeline = []
  let payments = []
  let paidTotal = 0 // pesewas

  if (primary) {
    const tl = await db
      .prepare(
        `SELECT id, title, description, due_date, status, sort, amount, currency, escrow_status
         FROM timeline_events WHERE inquiry_id = ? ORDER BY sort ASC, created_at ASC`
      )
      .bind(primary.id)
      .all()
    timeline = tl.results

    const pay = await db
      .prepare(
        `SELECT reference, amount, currency, status, channel, purpose, paid_at, created_at
         FROM payments WHERE inquiry_id = ? ORDER BY created_at DESC`
      )
      .bind(primary.id)
      .all()
    payments = pay.results
    paidTotal = payments
      .filter((p) => p.status === 'success')
      .reduce((sum, p) => sum + p.amount, 0)
  }

  // Money in whole cedis for the UI.
  const estimate = primary?.estimate || 0
  const paid = Math.round(paidTotal / 100)
  const balance = Math.max(0, estimate - paid)

  return json({
    ok: true,
    client,
    primary,
    inquiries,
    timeline,
    payments,
    summary: {
      estimate,
      paid,
      balance,
      deposit: primary?.deposit || 0,
      escrow: escrowTotals(timeline),
    },
  })
}
