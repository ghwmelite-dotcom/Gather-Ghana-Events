// GET /api/org/activity [?inquiry=<id>&limit=N] — the who-did-what trail.

import { ok, fail } from '../../_lib/respond.js'
import { clampStr } from '../../_lib/util.js'
import { currentOrganizer } from '../../_lib/auth.js'

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const url = new URL(request.url)
  const inquiry = clampStr(url.searchParams.get('inquiry'), 60)
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit')) || 40))

  const sql = `SELECT id, actor_email, action, entity_type, entity_id, inquiry_id, detail, created_at
               FROM activity_log ${inquiry ? 'WHERE inquiry_id = ?' : ''}
               ORDER BY created_at DESC LIMIT ?`
  const stmt = inquiry ? env.DB.prepare(sql).bind(inquiry, limit) : env.DB.prepare(sql).bind(limit)
  const { results } = await stmt.all()
  return ok({ activity: results })
}
