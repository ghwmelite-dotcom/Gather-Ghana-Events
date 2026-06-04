// GET /api/paystack/callback?reference=...&to=/path
// Paystack redirects the customer here after checkout. We verify the
// transaction server-side, reconcile it (deposit OR contribution), then
// redirect back into the app — to `to` if provided, else the booking page.

import * as paystack from '../../_lib/paystack.js'
import { reconcilePaid, reconcileFailed } from '../../_lib/reconcile.js'

// Only allow same-site relative redirect targets (no open redirect).
function safePath(to, fallback) {
  if (typeof to === 'string' && to.startsWith('/') && !to.startsWith('//')) return to
  return fallback
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const reference = url.searchParams.get('reference') || url.searchParams.get('trxref')
  const site = env.SITE_URL || url.origin
  const dest = safePath(url.searchParams.get('to'), '/book')
  const join = dest.includes('?') ? '&' : '?'

  if (!reference) return Response.redirect(`${site}${dest}${join}payment=error`, 302)

  try {
    const tx = await paystack.verify(env, reference)
    if (tx.status === 'success') {
      await reconcilePaid(env.DB, reference, {
        channel: tx.channel,
        paidAt: tx.paid_at ? Date.parse(tx.paid_at) : Date.now(),
      })
      return Response.redirect(
        `${site}${dest}${join}payment=success&ref=${encodeURIComponent(reference)}`,
        302
      )
    }
    await reconcileFailed(env.DB, reference)
    return Response.redirect(`${site}${dest}${join}payment=failed`, 302)
  } catch {
    return Response.redirect(`${site}${dest}${join}payment=error`, 302)
  }
}
