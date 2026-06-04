// POST /api/vendors/:slug/reviews — leave a review (auth: a signed-in client).
// Recomputes the vendor's average rating + count.

import { ok, fail, readJson } from '../../../_lib/respond.js'
import { uid, now, clampStr } from '../../../_lib/util.js'
import { currentClientId } from '../../../_lib/auth.js'

export async function onRequestPost({ params, request, env }) {
  const clientId = await currentClientId(request, env)
  if (!clientId) return fail('Sign in to leave a review', 401)

  const db = env.DB
  const vendor = await db.prepare('SELECT id FROM vendors WHERE slug = ?').bind(params.slug).first()
  if (!vendor) return fail('Vendor not found', 404)

  const body = await readJson(request)
  const rating = Math.max(1, Math.min(5, parseInt(body.rating) || 0))
  const text = clampStr(body.body, 1000)
  const author = clampStr(body.author, 80) || 'A client'
  if (!rating) return fail('Please choose a rating', 422)

  await db
    .prepare('INSERT INTO vendor_reviews (id, vendor_id, author, rating, body, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(uid('vr_'), vendor.id, author, rating, text, now())
    .run()

  // Recompute aggregates.
  const agg = await db
    .prepare('SELECT AVG(rating) AS avg, COUNT(*) AS n FROM vendor_reviews WHERE vendor_id = ?')
    .bind(vendor.id)
    .first()
  await db
    .prepare('UPDATE vendors SET rating = ?, reviews_count = ? WHERE id = ?')
    .bind(Math.round((agg.avg || 0) * 10) / 10, agg.n, vendor.id)
    .run()

  return ok({ rating: Math.round((agg.avg || 0) * 10) / 10, reviews_count: agg.n })
}
