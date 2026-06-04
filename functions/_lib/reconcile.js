// Single source of truth for turning a verified Paystack reference into a
// settled record. Routes by where the reference lives (payments vs
// contributions). Idempotent — safe to call from both the redirect callback
// and the server webhook for the same reference.

import { markPaid, markFailed } from './payments.js'
import { now } from './util.js'

/**
 * @returns {Promise<{kind: 'payment'|'contribution'|null, changed: boolean}>}
 */
export async function reconcilePaid(db, reference, { channel = null, paidAt = now() } = {}) {
  // 1) Deposit / balance payment?
  const payment = await db
    .prepare('SELECT id FROM payments WHERE reference = ?')
    .bind(reference)
    .first()
  if (payment) {
    const changed = await markPaid(db, reference, { channel, paidAt })
    return { kind: 'payment', changed }
  }

  // 2) Event contribution?
  const contribution = await db
    .prepare('SELECT id, status FROM contributions WHERE reference = ?')
    .bind(reference)
    .first()
  if (contribution) {
    if (contribution.status === 'success') return { kind: 'contribution', changed: false }
    await db
      .prepare("UPDATE contributions SET status = 'success' WHERE reference = ?")
      .bind(reference)
      .run()
    return { kind: 'contribution', changed: true }
  }

  return { kind: null, changed: false }
}

export async function reconcileFailed(db, reference) {
  const payment = await db
    .prepare('SELECT id FROM payments WHERE reference = ?')
    .bind(reference)
    .first()
  if (payment) {
    await markFailed(db, reference)
    return { kind: 'payment' }
  }
  await db
    .prepare("UPDATE contributions SET status = 'failed' WHERE reference = ? AND status = 'pending'")
    .bind(reference)
    .run()
  return { kind: 'contribution' }
}
