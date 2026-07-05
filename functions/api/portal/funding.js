// /api/portal/funding — a signed-in client's OWN self-serve funding page.
//   GET                       -> { event, lineItems, canCreate, inquiry }
//   POST { action, ... }      -> create | update | import_lines | line_upsert | line_delete
// Money is never enabled here — a self-serve page stays contributions_enabled=0 until an
// organizer accepts it (functions/api/org/events.js accept_self_serve).

import { ok, fail, readJson } from '../../_lib/respond.js'
import { uid, now, clampStr } from '../../_lib/util.js'
import { currentClientId } from '../../_lib/auth.js'
import { createEventRecord } from '../../_lib/events.js'
import { lineItemsFromQuote, progressPct } from '../../_lib/funding.js'

async function currentClient(request, env) {
  const clientId = await currentClientId(request, env)
  if (!clientId) return null
  return env.DB.prepare('SELECT id, email, name FROM clients WHERE id = ?').bind(clientId).first()
}

// The client's own self-serve event (most recent), or null.
function ownEvent(db, email) {
  return db
    .prepare('SELECT * FROM events WHERE owner_email = ? AND self_serve = 1 ORDER BY created_at DESC LIMIT 1')
    .bind(email)
    .first()
}

// The client's most recent inquiry (the quote source), or null.
function latestInquiry(db, clientId) {
  return db
    .prepare('SELECT id, event_type, event_date, quote_json FROM inquiries WHERE client_id = ? ORDER BY created_at DESC LIMIT 1')
    .bind(clientId)
    .first()
}

async function lineItemsFor(db, eventId) {
  const { results } = await db
    .prepare(
      `SELECT li.id, li.label, li.target_amount, li.visible, li.delivery_status, li.sort,
              COALESCE(SUM(CASE WHEN c.status = 'success' THEN c.amount END), 0) AS raised
       FROM event_line_items li
       LEFT JOIN contributions c ON c.line_item_id = li.id
       WHERE li.event_id = ?
       GROUP BY li.id
       ORDER BY li.sort, li.created_at`
    )
    .bind(eventId)
    .all()
  return results.map((l) => ({
    id: l.id, label: l.label, target: l.target_amount, raised: l.raised,
    pct: progressPct(l.raised, l.target_amount), visible: l.visible, sort: l.sort,
    delivery_status: l.delivery_status,
  }))
}

export async function onRequestGet({ request, env }) {
  const client = await currentClient(request, env)
  if (!client) return fail('Not signed in', 401)
  const db = env.DB

  const inquiry = await latestInquiry(db, client.id)
  const event = await ownEvent(db, client.email)
  if (!event) {
    return ok({
      event: null,
      canCreate: Boolean(inquiry),
      inquiry: inquiry
        ? { id: inquiry.id, event_type: inquiry.event_type, event_date: inquiry.event_date, hasQuote: Boolean(inquiry.quote_json) }
        : null,
    })
  }

  return ok({
    event: { id: event.id, slug: event.slug, title: event.title, host_names: event.host_names, event_date: event.event_date, story: event.story, cover_image: event.cover_image, contributions_enabled: event.contributions_enabled, visibility: event.visibility },
    lineItems: await lineItemsFor(db, event.id),
    inquiry: inquiry ? { id: inquiry.id, hasQuote: Boolean(inquiry.quote_json) } : null,
    canCreate: false,
  })
}

export async function onRequestPost({ request, env }) {
  const client = await currentClient(request, env)
  if (!client) return fail('Not signed in', 401)
  const db = env.DB
  const body = await readJson(request)
  const action = body.action

  if (action === 'create') {
    const existing = await ownEvent(db, client.email)
    if (existing) return fail('You already have a funding page', 409)
    const inquiry = await latestInquiry(db, client.id)
    try {
      const res = await createEventRecord(db, client.email, {
        title: body.title,
        host_names: body.host_names,
        event_type: body.event_type,
        event_date: body.event_date,
        cover_image: body.cover_image,
        story: body.story,
        inquiry_id: inquiry?.id || null,
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

  // All remaining actions operate only on the client's own self-serve event.
  const event = await ownEvent(db, client.email)
  if (!event) return fail('No funding page yet', 404)

  if (action === 'update') {
    // Keep the existing title if the client clears it — a basics edit shouldn't blank the page title.
    await db
      .prepare('UPDATE events SET title = ?, host_names = ?, event_date = ?, cover_image = ?, story = ? WHERE id = ?')
      .bind(clampStr(body.title, 120) || event.title, clampStr(body.host_names, 160), clampStr(body.event_date, 20), clampStr(body.cover_image, 400), clampStr(body.story, 4000), event.id)
      .run()
    return ok({ id: event.id })
  }

  if (action === 'import_lines') {
    const existing = await db.prepare('SELECT COUNT(*) AS n FROM event_line_items WHERE event_id = ?').bind(event.id).first()
    if (existing.n > 0) return fail('You already have funding lines — delete them first, or add manually.', 409)
    if (!event.inquiry_id) return fail('This funding page has no linked inquiry to import from', 422)
    const inq = await db.prepare('SELECT quote_json FROM inquiries WHERE id = ?').bind(event.inquiry_id).first()
    const rows = lineItemsFromQuote(inq?.quote_json)
    if (!rows.length) return fail('No saved quote to import', 422)
    const ts = now()
    await db.batch(
      rows.map((r, i) =>
        db.prepare(
          `INSERT INTO event_line_items (id, event_id, label, category_key, target_amount, sort, visible, delivery_status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, 'pending', ?)`
        ).bind(uid('eli_'), event.id, r.label, r.category_key, r.target_amount, i, ts)
      )
    )
    return ok({ imported: rows.length })
  }

  if (action === 'line_upsert') {
    const label = clampStr(body.label, 120)
    if (!label) return fail('A label is required', 422)
    const target = Math.max(0, Math.round(Number(body.target_amount) || 0))
    const sort = parseInt(body.sort) || 0
    const visible = body.visible === false ? 0 : 1
    if (body.id) {
      const id = clampStr(body.id, 60)
      if (!id) return fail('id is required', 422)
      const ex = await db.prepare('SELECT id FROM event_line_items WHERE id = ? AND event_id = ?').bind(id, event.id).first()
      if (!ex) return fail('Line not found', 404)
      await db.prepare('UPDATE event_line_items SET label = ?, target_amount = ?, sort = ?, visible = ? WHERE id = ?')
        .bind(label, target, sort, visible, id).run()
      return ok({ id })
    }
    const id = uid('eli_')
    await db.prepare(
      `INSERT INTO event_line_items (id, event_id, label, category_key, target_amount, sort, visible, delivery_status, created_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?, 'pending', ?)`
    ).bind(id, event.id, label, target, sort, visible, now()).run()
    return ok({ id })
  }

  if (action === 'line_delete') {
    const id = clampStr(body.id, 60)
    if (!id) return fail('id is required', 422)
    const ex = await db.prepare('SELECT id FROM event_line_items WHERE id = ? AND event_id = ?').bind(id, event.id).first()
    if (!ex) return fail('Line not found', 404)
    await db.batch([
      db.prepare('UPDATE contributions SET line_item_id = NULL WHERE line_item_id = ?').bind(id),
      db.prepare('DELETE FROM event_line_items WHERE id = ?').bind(id),
    ])
    return ok({ deleted: true })
  }

  return fail('Unknown action', 422)
}
