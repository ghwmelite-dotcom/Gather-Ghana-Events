// POST /api/portal/milestones — client acts on a milestone's escrow.
// Body: { milestoneId, action: 'approve' | 'dispute' }

import { ok, fail, readJson } from '../../_lib/respond.js'
import { currentClientId } from '../../_lib/auth.js'
import { applyAction } from '../../_lib/escrow.js'
import { logActivity } from '../../_lib/activity.js'

const CLIENT_ACTIONS = ['approve', 'dispute']

export async function onRequestPost({ request, env }) {
  const clientId = await currentClientId(request, env)
  if (!clientId) return fail('Not signed in', 401)

  const { milestoneId, action } = await readJson(request)
  if (!CLIENT_ACTIONS.includes(action)) return fail('Unknown action', 422)

  const db = env.DB
  // Ensure the milestone belongs to one of this client's inquiries.
  const m = await db
    .prepare(
      `SELECT t.id, t.title, t.inquiry_id, t.escrow_status, c.email AS client_email
       FROM timeline_events t
       JOIN inquiries i ON i.id = t.inquiry_id
       JOIN clients c ON c.id = i.client_id
       WHERE t.id = ? AND i.client_id = ?`
    )
    .bind(milestoneId, clientId)
    .first()
  if (!m) return fail('Milestone not found', 404)

  const next = applyAction(m.escrow_status, action)
  if (!next) return fail(`Can't ${action} a milestone that is ${m.escrow_status}`, 409)

  await db
    .prepare('UPDATE timeline_events SET escrow_status = ? WHERE id = ?')
    .bind(next, milestoneId)
    .run()

  await logActivity(db, {
    actor: m.client_email, action: `escrow.${action}`, entityType: 'milestone', entityId: m.id,
    inquiryId: m.inquiry_id, detail: `Client ${action === 'approve' ? 'approved release of' : 'disputed'} "${m.title}"`,
  })
  return ok({ milestoneId, escrow_status: next })
}
