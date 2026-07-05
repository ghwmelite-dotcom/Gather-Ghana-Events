// GET /api/content — published editable page content, grouped by type.

import { ok } from '../../_lib/respond.js'
import { groupContent } from '../../_lib/site-content.js'

export async function onRequestGet({ env }) {
  const { results } = await env.DB
    .prepare('SELECT id, type, data, sort, published FROM site_content WHERE published = 1 ORDER BY type ASC, sort ASC, created_at ASC')
    .all()
  return ok(groupContent(results))
}
