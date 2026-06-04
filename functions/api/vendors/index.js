// GET /api/vendors?category=&location=&q= — marketplace directory.

import { json } from '../../_lib/respond.js'
import { clampStr } from '../../_lib/util.js'

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const category = clampStr(url.searchParams.get('category') || '', 40)
  const q = clampStr(url.searchParams.get('q') || '', 60)

  const where = []
  const binds = []
  if (category) { where.push('category = ?'); binds.push(category) }
  if (q) { where.push('(name LIKE ? OR tagline LIKE ? OR location LIKE ?)'); binds.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const { results } = await env.DB
    .prepare(
      `SELECT slug, name, category, location, tagline, image, price_from, currency, verified, rating, reviews_count
       FROM vendors ${clause} ORDER BY verified DESC, rating DESC, reviews_count DESC`
    )
    .bind(...binds)
    .all()

  return json({ ok: true, vendors: results })
}
