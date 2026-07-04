// /api/org/tasks — team to-dos, optionally tied to a client's event.
//   GET [?inquiry=<id>]     -> { tasks, team, inquiries }
//   POST { action, ... }    -> create | update | set_status | delete

import { ok, fail, readJson } from '../../_lib/respond.js'
import { uid, now, clampStr } from '../../_lib/util.js'
import { currentOrganizer, currentEditor, isOrganizerEmail } from '../../_lib/auth.js'
import { logActivity } from '../../_lib/activity.js'

const STATUSES = ['open', 'in_progress', 'done']

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const db = env.DB
  const inquiry = clampStr(new URL(request.url).searchParams.get('inquiry'), 60)

  const taskSql = `
    SELECT t.id, t.inquiry_id, t.title, t.notes, t.assignee_email, t.due_date, t.status,
           t.created_by, t.completed_at, t.created_at,
           c.name AS client_name, i.event_type
    FROM tasks t
    LEFT JOIN inquiries i ON i.id = t.inquiry_id
    LEFT JOIN clients c ON c.id = i.client_id
    ${inquiry ? 'WHERE t.inquiry_id = ?' : ''}
    ORDER BY (t.status = 'done'), COALESCE(NULLIF(t.due_date, ''), '9999'), t.created_at DESC
    LIMIT 300`

  const cfg = (env.ORGANIZER_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean)
  const memberWhere = cfg.length ? `is_organizer = 1 OR email IN (${cfg.map(() => '?').join(',')})` : 'is_organizer = 1'

  const [tasks, members, inquiries] = await Promise.all([
    (inquiry ? db.prepare(taskSql).bind(inquiry) : db.prepare(taskSql)).all(),
    db.prepare(`SELECT email, name FROM clients WHERE ${memberWhere} ORDER BY name`).bind(...cfg).all(),
    db.prepare(`SELECT i.id, i.event_type, i.event_date, c.name
                FROM inquiries i JOIN clients c ON c.id = i.client_id
                ORDER BY i.created_at DESC LIMIT 100`).all(),
  ])

  return ok({
    tasks: tasks.results,
    team: members.results.map((m) => ({ ...m, source: isOrganizerEmail(env, m.email) ? 'config' : 'db' })),
    inquiries: inquiries.results.map((i) => ({ id: i.id, label: `${i.name} · ${i.event_type}${i.event_date ? ` · ${i.event_date}` : ''}` })),
  })
}

export async function onRequestPost({ request, env }) {
  const org = await currentEditor(request, env)
  if (!org) return fail("Read-only access — this action isn't available.", 403)
  const db = env.DB
  const body = await readJson(request)
  const action = body.action

  if (action === 'create') {
    const title = clampStr(body.title, 200)
    if (!title) return fail('Task title is required', 422)
    const inquiryId = clampStr(body.inquiryId, 60) || null
    if (inquiryId) {
      const owned = await db.prepare('SELECT id FROM inquiries WHERE id = ?').bind(inquiryId).first()
      if (!owned) return fail('Linked event not found', 404)
    }
    const id = uid('task_')
    await db
      .prepare(
        `INSERT INTO tasks (id, inquiry_id, title, notes, assignee_email, due_date, status, created_by, created_at)
         VALUES (?,?,?,?,?,?,'open',?,?)`
      )
      .bind(
        id, inquiryId, title, clampStr(body.notes, 1000) || null,
        clampStr(body.assignee_email, 160).toLowerCase() || null,
        clampStr(body.due_date, 20) || null, org.email, now()
      )
      .run()
    await logActivity(db, {
      actor: org.email, action: 'task.create', entityType: 'task', entityId: id, inquiryId,
      detail: `Task "${title}" added${body.assignee_email ? ` for ${clampStr(body.assignee_email, 160)}` : ''}`,
    })
    return ok({ id })
  }

  if (action === 'update') {
    const id = clampStr(body.id, 60)
    const t = await db.prepare('SELECT id, title FROM tasks WHERE id = ?').bind(id).first()
    if (!t) return fail('Task not found', 404)
    const title = clampStr(body.title, 200) || t.title
    await db
      .prepare('UPDATE tasks SET title=?, notes=?, assignee_email=?, due_date=? WHERE id=?')
      .bind(
        title, clampStr(body.notes, 1000) || null,
        clampStr(body.assignee_email, 160).toLowerCase() || null,
        clampStr(body.due_date, 20) || null, id
      )
      .run()
    return ok({ id })
  }

  if (action === 'set_status') {
    const id = clampStr(body.id, 60)
    if (!STATUSES.includes(body.status)) return fail('Invalid status', 422)
    const t = await db.prepare('SELECT id, title, inquiry_id FROM tasks WHERE id = ?').bind(id).first()
    if (!t) return fail('Task not found', 404)
    await db
      .prepare('UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?')
      .bind(body.status, body.status === 'done' ? now() : null, id)
      .run()
    await logActivity(db, {
      actor: org.email, action: 'task.status', entityType: 'task', entityId: id, inquiryId: t.inquiry_id,
      detail: `Task "${t.title}" → ${body.status.replace('_', ' ')}`,
    })
    return ok({ id, status: body.status })
  }

  if (action === 'delete') {
    const id = clampStr(body.id, 60)
    const t = await db.prepare('SELECT title, inquiry_id FROM tasks WHERE id = ?').bind(id).first()
    await db.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run()
    if (t) await logActivity(db, {
      actor: org.email, action: 'task.delete', entityType: 'task', entityId: id, inquiryId: t.inquiry_id,
      detail: `Task "${t.title}" deleted`,
    })
    return ok({ deleted: true })
  }

  return fail('Unknown action', 422)
}
