// /api/org/vendors — organizer-managed vendor catalog.
//   GET                    -> list ALL vendors (incl. unverified)
//   POST { action, ... }   -> create | update | delete | verify

import { ok, fail, readJson } from '../../_lib/respond.js'
import { uid, now, clampStr, slugify } from '../../_lib/util.js'
import { currentOrganizer, currentEditor } from '../../_lib/auth.js'
import { toMinor } from '../../_lib/money.js'
import { logActivity } from '../../_lib/activity.js'

const CATEGORIES = ['catering', 'decor', 'venue', 'photography', 'music', 'cake', 'makeup']

// First slug not taken by a DIFFERENT vendor (root, root-2, root-3, …).
async function uniqueSlug(db, base, exceptId = null) {
  const root = slugify(base) || 'vendor'
  let slug = root
  let i = 2
  for (;;) {
    const row = await db.prepare('SELECT id FROM vendors WHERE slug = ?').bind(slug).first()
    if (!row || row.id === exceptId) return slug
    slug = `${root}-${i++}`
  }
}

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const { results } = await env.DB
    .prepare(
      `SELECT id, slug, name, category, location, tagline, about, image, price_from, currency,
              verified, rating, reviews_count, whatsapp, created_at
       FROM vendors ORDER BY created_at DESC`
    )
    .all()
  return ok({ vendors: results, categories: CATEGORIES })
}

export async function onRequestPost({ request, env }) {
  const org = await currentEditor(request, env)
  if (!org) return fail("Read-only access — this action isn't available.", 403)
  const db = env.DB
  const body = await readJson(request)
  const action = body.action

  if (action === 'create') {
    const name = clampStr(body.name, 120)
    const category = clampStr(body.category, 40)
    if (!name || !CATEGORIES.includes(category)) return fail('name and a valid category are required', 422)
    const id = uid('ven_')
    const slug = await uniqueSlug(db, name)
    await db
      .prepare(
        `INSERT INTO vendors (id, slug, name, category, location, tagline, about, image,
                              price_from, currency, verified, rating, reviews_count, whatsapp, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,0,0,?,?)`
      )
      .bind(
        id, slug, name, category,
        clampStr(body.location, 120), clampStr(body.tagline, 200), clampStr(body.about, 2000),
        clampStr(body.image, 500), Math.max(0, toMinor(parseFloat(body.price_from) || 0, 'GHS')), 'GHS',
        body.verified ? 1 : 0, clampStr(body.whatsapp, 30), now()
      )
      .run()
    await logActivity(db, { actor: org.email, action: 'vendor.create', entityType: 'vendor', entityId: id, detail: `Vendor "${name}" added` })
    return ok({ id, slug })
  }

  if (action === 'update') {
    const id = clampStr(body.id, 60)
    const existing = await db.prepare('SELECT id, name, slug FROM vendors WHERE id = ?').bind(id).first()
    if (!existing) return fail('Vendor not found', 404)
    const name = clampStr(body.name, 120) || existing.name
    const category = CATEGORIES.includes(body.category) ? body.category : null
    const slug = name !== existing.name ? await uniqueSlug(db, name, id) : existing.slug
    // Callers (the org vendor form) send the FULL record, so empty strings intentionally
    // clear optional fields. category is the one exception, preserved when invalid/omitted.
    await db
      .prepare(
        `UPDATE vendors SET name=?, slug=?, category=COALESCE(?,category), location=?, tagline=?,
                about=?, image=?, price_from=?, whatsapp=? WHERE id=?`
      )
      .bind(
        name, slug, category,
        clampStr(body.location, 120), clampStr(body.tagline, 200), clampStr(body.about, 2000),
        clampStr(body.image, 500), Math.max(0, toMinor(parseFloat(body.price_from) || 0, 'GHS')),
        clampStr(body.whatsapp, 30), id
      )
      .run()
    await logActivity(db, { actor: org.email, action: 'vendor.update', entityType: 'vendor', entityId: id, detail: `Vendor "${name}" updated` })
    return ok({ id, slug })
  }

  if (action === 'delete') {
    const id = clampStr(body.id, 60)
    const v = await db.prepare('SELECT name FROM vendors WHERE id = ?').bind(id).first()
    await db.prepare('DELETE FROM vendors WHERE id = ?').bind(id).run()
    if (v) await logActivity(db, { actor: org.email, action: 'vendor.delete', entityType: 'vendor', entityId: id, detail: `Vendor "${v.name}" deleted` })
    return ok({ deleted: true })
  }

  if (action === 'verify') {
    const id = clampStr(body.id, 60)
    const r = await db
      .prepare('UPDATE vendors SET verified = ? WHERE id = ?')
      .bind(body.verified ? 1 : 0, id)
      .run()
    if (!r.meta.changes) return fail('Vendor not found', 404)
    await logActivity(db, { actor: org.email, action: 'vendor.verify', entityType: 'vendor', entityId: id, detail: `Vendor ${body.verified ? 'verified' : 'unverified'}` })
    return ok({ id, verified: body.verified ? 1 : 0 })
  }

  return fail('Unknown action', 422)
}
