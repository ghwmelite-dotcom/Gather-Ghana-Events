// POST /api/org/vendors — admin verifies / unverifies a vendor.

import { ok, fail, readJson } from '../../_lib/respond.js'
import { clampStr } from '../../_lib/util.js'
import { currentOrganizer } from '../../_lib/auth.js'

export async function onRequestPost({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const { slug, verified } = await readJson(request)
  const r = await env.DB.prepare('UPDATE vendors SET verified = ? WHERE slug = ?')
    .bind(verified ? 1 : 0, clampStr(slug, 80))
    .run()
  if (!r.meta.changes) return fail('Vendor not found', 404)
  return ok({ slug, verified: verified ? 1 : 0 })
}
