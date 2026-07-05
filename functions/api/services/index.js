// GET /api/services — published services for the public /services page.

import { ok } from '../../_lib/respond.js'
import { parseFeatures } from '../../_lib/services.js'

export async function onRequestGet({ env }) {
  const { results } = await env.DB
    .prepare('SELECT * FROM services WHERE published = 1 ORDER BY sort ASC, created_at ASC')
    .all()
  const services = results.map((s) => ({
    id: s.id, name: s.name, tagline: s.tagline, description: s.description,
    image: s.image, features: parseFeatures(s.features), price_from: s.price_from,
    featured: s.featured === 1,
  }))
  return ok({ services })
}
