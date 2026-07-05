// POST /api/inquiries
// Creates/updates the client, stores the inquiry, and (if Paystack is
// configured) initializes a deposit transaction and returns the checkout URL.

import { ok, fail, readJson } from '../_lib/respond.js'
import { uid, now, isEmail, clampStr } from '../_lib/util.js'
import * as paystack from '../_lib/paystack.js'
import { sendInquiryEmails } from '../_lib/email.js'

const EVENT_TYPES = ['Wedding', 'Birthday', 'Corporate', 'Other']

export async function onRequestPost({ request, env, waitUntil }) {
  const body = await readJson(request)

  const name = clampStr(body.name, 120)
  const email = clampStr(body.email, 160).toLowerCase()
  const phone = clampStr(body.phone, 40)
  const date = clampStr(body.date, 20)
  const notes = clampStr(body.notes, 2000)
  const quoteJson = typeof body.quoteJson === 'string' ? body.quoteJson.slice(0, 8000) : null
  const type = EVENT_TYPES.includes(body.type) ? body.type : 'Other'
  const guests = Math.max(0, Math.min(100000, parseInt(body.guests) || 0))
  const estimate = Math.max(0, parseInt(body.estimate) || 0)
  const deposit = Math.max(0, parseInt(body.deposit) || 0)

  // Validate — name + email are required; phone/date optional (package-builder leads).
  const errors = {}
  if (!name) errors.name = 'Name is required'
  if (!isEmail(email)) errors.email = 'Valid email is required'
  if (Object.keys(errors).length) return fail('Please check the form', 422, { fields: errors })

  const db = env.DB
  const ts = now()

  // Upsert client by email.
  let client = await db
    .prepare('SELECT id FROM clients WHERE email = ?')
    .bind(email)
    .first()

  let clientId
  if (client) {
    clientId = client.id
    await db
      .prepare('UPDATE clients SET name = ?, phone = ? WHERE id = ?')
      .bind(name, phone, clientId)
      .run()
  } else {
    clientId = uid('cl_')
    await db
      .prepare('INSERT INTO clients (id, email, name, phone, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(clientId, email, name, phone, ts)
      .run()
  }

  // Store the inquiry.
  const inquiryId = uid('inq_')
  await db
    .prepare(
      `INSERT INTO inquiries
       (id, client_id, event_type, event_date, guests, estimate, deposit, notes, quote_json, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`
    )
    .bind(inquiryId, clientId, type, date, guests, estimate, deposit, notes, quoteJson, ts)
    .run()

  // Fire-and-forget confirmation + organizer notification (no-op without Resend).
  const site = env.SITE_URL || new URL(request.url).origin
  const emailJob = sendInquiryEmails(env, { clientEmail: email, clientName: name, type, date, site })
  if (waitUntil) waitUntil(emailJob); else await emailJob.catch(() => {})

  // Initialize a Paystack deposit, if configured and a deposit is due.
  let payment = null
  if (paystack.isConfigured(env) && deposit > 0) {
    try {
      const reference = `GGE-${ts.toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
      const amount = deposit * 100 // pesewas
      const callbackUrl = `${env.SITE_URL || new URL(request.url).origin}/api/paystack/callback`

      const tx = await paystack.initialize(env, {
        email,
        amount,
        reference,
        callbackUrl,
        metadata: { inquiryId, clientId, type, name },
      })

      await db
        .prepare(
          `INSERT INTO payments
           (id, inquiry_id, client_id, reference, amount, currency, status, purpose, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', 'deposit', ?)`
        )
        .bind(uid('pay_'), inquiryId, clientId, reference, amount, env.PAYSTACK_CURRENCY || 'GHS', ts)
        .run()

      payment = { authorization_url: tx.authorization_url, reference }
    } catch (err) {
      // Inquiry is saved regardless; surface a soft note but still succeed.
      return ok({ inquiryId, payment: null, paymentError: String(err.message || err) })
    }
  }

  return ok({ inquiryId, payment })
}
