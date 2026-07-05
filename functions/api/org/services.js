// /api/org/services — admin CRUD for the services catalog.
//   GET                    -> { services }  (incl. unpublished)
//   POST { action, ... }   -> create | update | delete

import { ok, fail, readJson } from '../../_lib/respond.js'
import { uid, now, clampStr } from '../../_lib/util.js'
import { currentOrganizer, currentEditor } from '../../_lib/auth.js'
import { parseFeatures } from '../../_lib/services.js'
import { logActivity } from '../../_lib/activity.js'

const normFeatures = (arr) =>
  JSON.stringify(Array.isArray(arr) ? arr.map((x) => clampStr(String(x), 120)).filter(Boolean).slice(0, 20) : [])

const readFields = (body) => ({
  name: clampStr(body.name, 120),
  tagline: clampStr(body.tagline, 200),
  description: clampStr(body.description, 4000),
  image: clampStr(body.image, 500),
  features: normFeatures(body.features),
  price_from: Math.max(0, parseInt(body.price_from) || 0),
  featured: body.featured ? 1 : 0,
  published: body.published === false ? 0 : 1,
  sort: parseInt(body.sort) || 0,
})

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const { results } = await env.DB.prepare('SELECT * FROM services ORDER BY sort ASC, created_at ASC').all()
  return ok({
    services: results.map((s) => ({ ...s, features: parseFeatures(s.features), featured: s.featured === 1, published: s.published === 1 })),
  })
}

export async function onRequestPost({ request, env }) {
  const org = await currentEditor(request, env)
  if (!org) return fail("Read-only access — this action isn't available.", 403)
  const db = env.DB
  const body = await readJson(request)
  const action = body.action

  if (action === 'create') {
    const f = readFields(body)
    if (!f.name) return fail('Name is required', 422, { fields: { name: 'Name is required' } })
    const id = uid('svc_')
    await db.prepare('INSERT INTO services (id, name, tagline, description, image, features, price_from, featured, published, sort, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id, f.name, f.tagline, f.description, f.image, f.features, f.price_from, f.featured, f.published, f.sort, now()).run()
    await logActivity(db, { actor: org.email, action: 'service.create', entityType: 'service', entityId: id, detail: `Service "${f.name}" created` })
    return ok({ id })
  }

  if (action === 'update') {
    const id = clampStr(body.id, 60)
    const existing = await db.prepare('SELECT id FROM services WHERE id = ?').bind(id).first()
    if (!existing) return fail('Service not found', 404)
    const f = readFields(body)
    if (!f.name) return fail('Name is required', 422, { fields: { name: 'Name is required' } })
    await db.prepare('UPDATE services SET name=?, tagline=?, description=?, image=?, features=?, price_from=?, featured=?, published=?, sort=? WHERE id=?')
      .bind(f.name, f.tagline, f.description, f.image, f.features, f.price_from, f.featured, f.published, f.sort, id).run()
    await logActivity(db, { actor: org.email, action: 'service.update', entityType: 'service', entityId: id, detail: `Service "${f.name}" updated` })
    return ok({ id })
  }

  if (action === 'delete') {
    const id = clampStr(body.id, 60)
    const s = await db.prepare('SELECT name FROM services WHERE id = ?').bind(id).first()
    if (!s) return fail('Service not found', 404)
    await db.prepare('DELETE FROM services WHERE id = ?').bind(id).run()
    await logActivity(db, { actor: org.email, action: 'service.delete', entityType: 'service', entityId: id, detail: `Service "${s.name}" deleted` })
    return ok({ deleted: true })
  }

  return fail('Unknown action', 422)
}
