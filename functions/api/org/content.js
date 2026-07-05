// /api/org/content — admin CRUD for editable page content.
//   GET                    -> { process, faq, testimonial }  (incl. unpublished)
//   POST { action, ... }   -> create | update | delete

import { ok, fail, readJson } from '../../_lib/respond.js'
import { uid, now, clampStr } from '../../_lib/util.js'
import { currentOrganizer, currentEditor } from '../../_lib/auth.js'
import { groupContent, CONTENT_TYPES } from '../../_lib/site-content.js'
import { logActivity } from '../../_lib/activity.js'

const normData = (obj) => {
  const o = {}
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) o[clampStr(String(k), 40)] = clampStr(String(v ?? ''), 4000)
  }
  return JSON.stringify(o)
}

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const { results } = await env.DB
    .prepare('SELECT id, type, data, sort, published FROM site_content ORDER BY type ASC, sort ASC, created_at ASC')
    .all()
  return ok(groupContent(results))
}

export async function onRequestPost({ request, env }) {
  const org = await currentEditor(request, env)
  if (!org) return fail("Read-only access — this action isn't available.", 403)
  const db = env.DB
  const body = await readJson(request)
  const action = body.action

  if (action === 'create') {
    const type = clampStr(body.type, 20)
    if (!CONTENT_TYPES.includes(type)) return fail('Invalid type', 422)
    const id = uid('sc_')
    await db.prepare('INSERT INTO site_content (id, type, data, sort, published, created_at) VALUES (?,?,?,?,?,?)')
      .bind(id, type, normData(body.data), parseInt(body.sort) || 0, body.published === false ? 0 : 1, now()).run()
    await logActivity(db, { actor: org.email, action: 'content.create', entityType: 'content', entityId: id, detail: `${type} item added` })
    return ok({ id })
  }

  if (action === 'update') {
    const id = clampStr(body.id, 60)
    const existing = await db.prepare('SELECT id FROM site_content WHERE id = ?').bind(id).first()
    if (!existing) return fail('Item not found', 404)
    await db.prepare('UPDATE site_content SET data=?, sort=?, published=? WHERE id=?')
      .bind(normData(body.data), parseInt(body.sort) || 0, body.published === false ? 0 : 1, id).run()
    await logActivity(db, { actor: org.email, action: 'content.update', entityType: 'content', entityId: id, detail: 'content item updated' })
    return ok({ id })
  }

  if (action === 'delete') {
    const id = clampStr(body.id, 60)
    const ex = await db.prepare('SELECT id FROM site_content WHERE id = ?').bind(id).first()
    if (!ex) return fail('Item not found', 404)
    await db.prepare('DELETE FROM site_content WHERE id = ?').bind(id).run()
    await logActivity(db, { actor: org.email, action: 'content.delete', entityType: 'content', entityId: id, detail: 'content item deleted' })
    return ok({ deleted: true })
  }

  return fail('Unknown action', 422)
}
