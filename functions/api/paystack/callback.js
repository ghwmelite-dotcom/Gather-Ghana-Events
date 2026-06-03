// GET /api/paystack/callback?reference=...
// Paystack redirects the customer here after checkout. We verify the
// transaction server-side, reconcile it, then redirect back into the app.

import * as paystack from '../../_lib/paystack.js'
import { markPaid, markFailed } from '../../_lib/payments.js'

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const reference = url.searchParams.get('reference') || url.searchParams.get('trxref')
  const site = env.SITE_URL || url.origin

  if (!reference) return Response.redirect(`${site}/book?payment=error`, 302)

  try {
    const tx = await paystack.verify(env, reference)
    if (tx.status === 'success') {
      await markPaid(env.DB, reference, {
        channel: tx.channel,
        paidAt: tx.paid_at ? Date.parse(tx.paid_at) : Date.now(),
      })
      return Response.redirect(`${site}/book?payment=success&ref=${encodeURIComponent(reference)}`, 302)
    }
    await markFailed(env.DB, reference)
    return Response.redirect(`${site}/book?payment=failed`, 302)
  } catch {
    return Response.redirect(`${site}/book?payment=error`, 302)
  }
}
