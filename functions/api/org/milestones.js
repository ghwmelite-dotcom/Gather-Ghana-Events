// POST /api/org/milestones — admin manages a client's milestones.
// Actions: upsert | fund | request_release | delete.
// Admin can FUND and REQUEST_RELEASE; only the CLIENT can release (Gather Guarantee).

import { ok, fail, readJson } from '../../_lib/respond.js'
import { uid, now, clampStr } from '../../_lib/util.js'
import { currentOrganizer } from '../../_lib/auth.js'
import { applyAction } from '../../_lib/escrow.js'
import { toMinor } from '../../_lib/money.js'

const ADMIN_ESCROW = { fund: 'fund', request_release: 'request_release' }
const STATUSES = ['upcoming', 'in_progress', 'done']

export async function onRequestPost({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const db = env.DB
  const body = await readJson(request)
  const action = body.action

  if (action === 'upsert') {
    const inquiryId = clampStr(body.inquiryId, 60)
    const title = clampStr(body.title, 160)
    if (!inquiryId || !title) return fail('inquiryId and title required', 422)
    const status = STATUSES.includes(body.status) ? body.status : 'upcoming'
    const amount = toMinor(parseFloat(body.amount) || 0, 'GHS')
    const fields = [clampStr(body.description, 1000), clampStr(body.due_date, 20), status, amount, parseInt(body.sort) || 0]

    if (body.id) {
      const owned = await db.prepare('SELECT id FROM timeline_events WHERE id = ? AND inquiry_id = ?').bind(body.id, inquiryId).first()
      if (!owned) return fail('Milestone not found', 404)
      await db.prepare('UPDATE timeline_events SET title=?, description=?, due_date=?, status=?, amount=?, sort=? WHERE id=?')
        .bind(title, ...fields, body.id).run()
      return ok({ id: body.id })
    }
    const id = uid('tl_')
    await db.prepare('INSERT INTO timeline_events (id, inquiry_id, title, description, due_date, status, amount, currency, sort, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(id, inquiryId, title, fields[0], fields[1], status, amount, 'GHS', fields[4], now()).run()
    return ok({ id })
  }

  if (action === 'delete') {
    await db.prepare('DELETE FROM timeline_events WHERE id = ?').bind(clampStr(body.id, 60)).run()
    return ok({ deleted: true })
  }

  if (ADMIN_ESCROW[action]) {
    const m = await db.prepare('SELECT id, escrow_status FROM timeline_events WHERE id = ?').bind(clampStr(body.id, 60)).first()
    if (!m) return fail('Milestone not found', 404)
    const next = applyAction(m.escrow_status, ADMIN_ESCROW[action])
    if (!next) return fail(`Can't ${action} from ${m.escrow_status}`, 409)
    await db.prepare('UPDATE timeline_events SET escrow_status = ? WHERE id = ?').bind(next, m.id).run()
    return ok({ id: m.id, escrow_status: next })
  }

  return fail('Unknown action', 422)
}
