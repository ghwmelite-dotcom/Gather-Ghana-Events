// /api/org/events — admin event pages + funding line items.
//   GET                         -> { events }
//   GET ?eventId=<id>           -> { lines }        (all lines for an event, incl. hidden)
//   GET ?quotes=1               -> { quotes }       (recent leads that have a saved quote)
//   POST { action, ... }        -> create | delete | import_lines | line_upsert | line_delete | line_delivery

import { ok, fail, readJson } from '../../_lib/respond.js'
import { uid, now, clampStr } from '../../_lib/util.js'
import { currentOrganizer, currentEditor } from '../../_lib/auth.js'
import { createEventRecord } from '../../_lib/events.js'
import { lineItemsFromQuote } from '../../_lib/funding.js'
import { logActivity } from '../../_lib/activity.js'

const DELIVERY = ['pending', 'booked', 'delivered']

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const db = env.DB
  const url = new URL(request.url)

  const eventId = url.searchParams.get('eventId')
  if (eventId) {
    const { results } = await db
      .prepare(
        `SELECT id, label, target_amount, sort, visible, delivery_status
         FROM event_line_items WHERE event_id = ? ORDER BY sort, created_at`
      )
      .bind(clampStr(eventId, 60))
      .all()
    return ok({ lines: results })
  }

  if (url.searchParams.get('quotes')) {
    const { results } = await db
      .prepare(
        `SELECT i.id AS inquiryId, i.event_type, c.name
         FROM inquiries i JOIN clients c ON c.id = i.client_id
         WHERE i.quote_json IS NOT NULL AND i.quote_json != ''
         ORDER BY i.created_at DESC LIMIT 50`
      )
      .all()
    const quotes = results.map((r) => ({ inquiryId: r.inquiryId, label: `${r.name} · ${r.event_type}` }))
    return ok({ quotes })
  }

  const { results } = await db
    .prepare(
      `SELECT id, slug, title, host_names, event_type, event_date, visibility, inquiry_id, created_at
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
      db.prepare('DELETE FROM event_line_items WHERE event_id = ?').bind(id),
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

  if (action === 'import_lines') {
    const eventId = clampStr(body.eventId, 60)
    const event = await db.prepare('SELECT id FROM events WHERE id = ?').bind(eventId).first()
    if (!event) return fail('Event not found', 404)
    const existing = await db.prepare('SELECT COUNT(*) AS n FROM event_line_items WHERE event_id = ?').bind(eventId).first()
    if (existing.n > 0) return fail('This event already has funding lines — delete them first, or add lines manually.', 409)
    const inquiryId = clampStr(body.inquiryId, 60)
    const inq = await db.prepare('SELECT quote_json FROM inquiries WHERE id = ?').bind(inquiryId).first()
    const rows = lineItemsFromQuote(inq?.quote_json)
    if (!rows.length) return fail('That lead has no saved quote to import', 422)
    const ts = now()
    await db.batch(
      rows.map((r, i) =>
        db.prepare(
          `INSERT INTO event_line_items (id, event_id, label, category_key, target_amount, sort, visible, delivery_status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, 'pending', ?)`
        ).bind(uid('eli_'), eventId, r.label, r.category_key, r.target_amount, i, ts)
      )
    )
    await logActivity(db, {
      actor: org.email, action: 'funding.import', entityType: 'event', entityId: eventId,
      detail: `Imported ${rows.length} funding lines from a quote`,
    })
    return ok({ imported: rows.length })
  }

  if (action === 'line_upsert') {
    const eventId = clampStr(body.eventId, 60)
    const label = clampStr(body.label, 120)
    if (!label) return fail('A label is required', 422)
    const target = Math.max(0, Math.round(Number(body.target_amount) || 0))
    const sort = parseInt(body.sort) || 0
    const visible = body.visible === false ? 0 : 1
    if (body.id) {
      const id = clampStr(body.id, 60)
      if (!id) return fail('id is required', 422)
      const ex = await db.prepare('SELECT id, event_id FROM event_line_items WHERE id = ?').bind(id).first()
      if (!ex) return fail('Line not found', 404)
      await db.prepare('UPDATE event_line_items SET label = ?, target_amount = ?, sort = ?, visible = ? WHERE id = ?')
        .bind(label, target, sort, visible, id).run()
      await logActivity(db, {
        actor: org.email, action: 'funding.line_update', entityType: 'event', entityId: ex.event_id,
        detail: `Funding line "${label}" updated`,
      })
      return ok({ id })
    }
    const event = await db.prepare('SELECT id FROM events WHERE id = ?').bind(eventId).first()
    if (!event) return fail('Event not found', 404)
    const id = uid('eli_')
    await db.prepare(
      `INSERT INTO event_line_items (id, event_id, label, category_key, target_amount, sort, visible, delivery_status, created_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?, 'pending', ?)`
    ).bind(id, eventId, label, target, sort, visible, now()).run()
    await logActivity(db, {
      actor: org.email, action: 'funding.line_add', entityType: 'event', entityId: eventId,
      detail: `Funding line "${label}" added`,
    })
    return ok({ id })
  }

  if (action === 'line_delete') {
    const id = clampStr(body.id, 60)
    if (!id) return fail('id is required', 422)
    const ex = await db.prepare('SELECT id, event_id, label FROM event_line_items WHERE id = ?').bind(id).first()
    if (!ex) return fail('Line not found', 404)
    await db.batch([
      db.prepare('UPDATE contributions SET line_item_id = NULL WHERE line_item_id = ?').bind(id),
      db.prepare('DELETE FROM event_line_items WHERE id = ?').bind(id),
    ])
    await logActivity(db, {
      actor: org.email, action: 'funding.line_delete', entityType: 'event', entityId: ex.event_id,
      detail: `Funding line "${ex.label}" deleted`,
    })
    return ok({ deleted: true })
  }

  if (action === 'line_delivery') {
    const id = clampStr(body.id, 60)
    if (!id) return fail('id is required', 422)
    const status = DELIVERY.includes(body.delivery_status) ? body.delivery_status : null
    if (!status) return fail('Invalid delivery status', 422)
    const ex = await db.prepare('SELECT event_id FROM event_line_items WHERE id = ?').bind(id).first()
    if (!ex) return fail('Line not found', 404)
    await db.prepare('UPDATE event_line_items SET delivery_status = ? WHERE id = ?').bind(status, id).run()
    await logActivity(db, {
      actor: org.email, action: 'funding.delivery', entityType: 'event', entityId: ex.event_id,
      detail: `Funding line marked ${status}`,
    })
    return ok({ id, delivery_status: status })
  }

  return fail('Unknown action', 422)
}
