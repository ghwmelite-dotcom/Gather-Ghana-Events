// /api/org/events — admin listing + create/delete of public event pages.
//   GET                    -> { events }
//   POST { action, ... }   -> create | delete

import { ok, fail, readJson } from '../../_lib/respond.js'
import { clampStr } from '../../_lib/util.js'
import { currentOrganizer, currentEditor } from '../../_lib/auth.js'
import { createEventRecord } from '../../_lib/events.js'
import { logActivity } from '../../_lib/activity.js'

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const { results } = await env.DB
    .prepare(
      `SELECT id, slug, title, host_names, event_type, event_date, visibility, created_at
       FROM events ORDER BY created_at DESC LIMIT 200`
    )
    .all()
  return ok({ events: results })
}

export async function onRequestPost({ request, env }) {
  const org = await currentEditor(request, env)
  if (!org) return fail("Read-only access — this action isn't available.", 403)
  const db = env.DB
  const body = await readJson(request)
  const action = body.action

  if (action === 'create') {
    try {
      const res = await createEventRecord(db, org.email, body)
      await logActivity(db, {
        actor: org.email, action: 'event.create', entityType: 'event', entityId: res.id,
        detail: `Event page "${clampStr(body.title, 120)}" created (/e/${res.slug})`,
      })
      return ok(res)
    } catch (e) {
      if (e.status === 422) return fail(e.message, 422, { fields: e.fields })
      throw e
    }
  }

  if (action === 'delete') {
    const id = clampStr(body.id, 60)
    const ev = await db.prepare('SELECT id, slug, title FROM events WHERE id = ?').bind(id).first()
    if (!ev) return fail('Event not found', 404)
    await db.batch([
      db.prepare('DELETE FROM event_schedule WHERE event_id = ?').bind(id),
      db.prepare('DELETE FROM event_gallery WHERE event_id = ?').bind(id),
      db.prepare('DELETE FROM rsvps WHERE event_id = ?').bind(id),
      db.prepare('DELETE FROM contributions WHERE event_id = ?').bind(id),
      db.prepare('DELETE FROM events WHERE id = ?').bind(id),
    ])
    await logActivity(db, {
      actor: org.email, action: 'event.delete', entityType: 'event', entityId: id,
      detail: `Event page "${ev.title}" deleted (/e/${ev.slug})`,
    })
    return ok({ deleted: true })
  }

  return fail('Unknown action', 422)
}
