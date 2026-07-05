// POST /api/events — create a shareable event (auth: a signed-in planner/client).

import { ok, fail, readJson } from '../../_lib/respond.js'
import { currentClientId } from '../../_lib/auth.js'
import { createEventRecord } from '../../_lib/events.js'

export async function onRequestPost({ request, env }) {
  const clientId = await currentClientId(request, env)
  if (!clientId) return fail('Not signed in', 401)

  const db = env.DB
  const owner = await db.prepare('SELECT email FROM clients WHERE id = ?').bind(clientId).first()
  const body = await readJson(request)
  try {
    const res = await createEventRecord(db, owner?.email || null, {
      ...body,
      self_serve: true,
      contributions_enabled: false,
      visibility: 'unlisted',
    })
    return ok(res)
  } catch (e) {
    if (e.status === 422) return fail(e.message, 422, { fields: e.fields })
    throw e
  }
}
