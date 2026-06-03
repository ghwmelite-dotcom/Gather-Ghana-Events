// POST /api/paystack/webhook
// Server-to-server confirmation. We verify the signature over the RAW body,
// then reconcile. This is the source of truth (the user may close the tab
// before the redirect callback fires).

import { ok, fail } from '../../_lib/respond.js'
import * as paystack from '../../_lib/paystack.js'
import { markPaid, markFailed } from '../../_lib/payments.js'

export async function onRequestPost({ request, env }) {
  const raw = await request.text()
  const signature = request.headers.get('x-paystack-signature')

  const valid = await paystack.verifyWebhook(env, raw, signature)
  if (!valid) return fail('Invalid signature', 401)

  let event
  try {
    event = JSON.parse(raw)
  } catch {
    return fail('Bad payload', 400)
  }

  const reference = event?.data?.reference
  if (!reference) return ok() // nothing to do

  if (event.event === 'charge.success') {
    await markPaid(env.DB, reference, {
      channel: event.data.channel,
      paidAt: event.data.paid_at ? Date.parse(event.data.paid_at) : Date.now(),
    })
  } else if (event.event === 'charge.failed') {
    await markFailed(env.DB, reference)
  }

  return ok()
}
