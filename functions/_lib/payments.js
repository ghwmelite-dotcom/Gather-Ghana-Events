// Reconciliation shared by the Paystack callback (user redirect) and the
// webhook (server-to-server). Idempotent: safe to call more than once per ref.

import { uid, now } from './util.js'

/**
 * Mark a payment successful and advance the inquiry, exactly once.
 * @param {D1Database} db
 * @param {string} reference
 * @param {{channel?: string, paidAt?: number}} meta
 * @returns {Promise<boolean>} true if this call transitioned the payment
 */
export async function markPaid(db, reference, { channel = null, paidAt = now() } = {}) {
  const payment = await db
    .prepare('SELECT id, inquiry_id, status FROM payments WHERE reference = ?')
    .bind(reference)
    .first()

  if (!payment) return false
  if (payment.status === 'success') return false // already reconciled

  await db
    .prepare("UPDATE payments SET status = 'success', channel = ?, paid_at = ? WHERE reference = ?")
    .bind(channel, paidAt, reference)
    .run()

  if (payment.inquiry_id) {
    await db
      .prepare("UPDATE inquiries SET status = 'booked' WHERE id = ? AND status = 'new'")
      .bind(payment.inquiry_id)
      .run()

    // Seed a "Deposit received" milestone if the timeline is empty.
    const existing = await db
      .prepare('SELECT COUNT(*) AS n FROM timeline_events WHERE inquiry_id = ?')
      .bind(payment.inquiry_id)
      .first()
    if (existing && existing.n === 0) {
      await db
        .prepare(
          `INSERT INTO timeline_events
           (id, inquiry_id, title, description, status, sort, created_at)
           VALUES (?, ?, 'Deposit received', 'Your date is secured. Thank you!', 'done', 1, ?)`
        )
        .bind(uid('tl_'), payment.inquiry_id, paidAt)
        .run()
    }
  }
  return true
}

export async function markFailed(db, reference) {
  await db
    .prepare("UPDATE payments SET status = 'failed' WHERE reference = ? AND status = 'pending'")
    .bind(reference)
    .run()
}
