// GET /api/vendors/:slug — vendor profile + reviews.

import { json, fail } from '../../_lib/respond.js'

export async function onRequestGet({ params, env }) {
  const vendor = await env.DB
    .prepare(
      `SELECT id, slug, name, category, location, tagline, about, image, price_from,
              currency, verified, rating, reviews_count
       FROM vendors WHERE slug = ?`
    )
    .bind(params.slug)
    .first()
  if (!vendor) return fail('Vendor not found', 404)

  const { results: reviews } = await env.DB
    .prepare('SELECT author, rating, body, created_at FROM vendor_reviews WHERE vendor_id = ? ORDER BY created_at DESC LIMIT 30')
    .bind(vendor.id)
    .all()

  return json({ ok: true, vendor, reviews })
}
