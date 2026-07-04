// POST /api/org/inquiry — admin sets a lead's lifecycle status.

import { ok, fail, readJson } from '../../_lib/respond.js'
import { clampStr } from '../../_lib/util.js'
import { currentOrganizer, currentEditor } from '../../_lib/auth.js'
import { logActivity } from '../../_lib/activity.js'

const STATUSES = ['new', 'quoted', 'booked', 'completed', 'cancelled']

export async function onRequestPost({ request, env }) {
  const org = await currentEditor(request, env)
  if (!org) return fail("Read-only access — this action isn't available.", 403)
  const { inquiryId, status } = await readJson(request)
  if (!STATUSES.includes(status)) return fail('Invalid status', 422)
  const id = clampStr(inquiryId, 60)
  const r = await env.DB.prepare('UPDATE inquiries SET status = ? WHERE id = ?').bind(status, id).run()
  if (!r.meta.changes) return fail('Inquiry not found', 404)
  await logActivity(env.DB, {
    actor: org.email, action: 'inquiry.status', entityType: 'inquiry', entityId: id,
    inquiryId: id, detail: `Lead status → ${status}`,
  })
  return ok({ inquiryId, status })
}
