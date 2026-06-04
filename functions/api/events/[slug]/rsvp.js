// POST /api/events/:slug/rsvp — public RSVP.

import { ok, fail, readJson } from '../../../_lib/respond.js'
import { uid, now, clampStr } from '../../../_lib/util.js'

const STATUSES = ['yes', 'no', 'maybe']

export async function onRequestPost({ params, request, env }) {
  const db = env.DB
  const event = await db
    .prepare('SELECT id, rsvp_enabled FROM events WHERE slug = ? AND visibility != ?')
    .bind(params.slug, 'private')
    .first()
  if (!event) return fail('Event not found', 404)
  if (!event.rsvp_enabled) return fail('RSVPs are closed for this event', 403)

  const body = await readJson(request)
  const name = clampStr(body.name, 120)
  const status = STATUSES.includes(body.status) ? body.status : 'yes'
  const party = Math.max(1, Math.min(50, parseInt(body.party_size) || 1))
  if (!name) return fail('Please enter your name', 422, { fields: { name: 'Name is required' } })

  await db
    .prepare(
      `INSERT INTO rsvps (id, event_id, name, email, phone, status, party_size, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      uid('rsvp_'), event.id, name, clampStr(body.email, 160), clampStr(body.phone, 40),
      status, party, clampStr(body.message, 1000), now()
    )
    .run()

  const agg = await db
    .prepare("SELECT COALESCE(SUM(party_size),0) AS guests, COUNT(*) AS replies FROM rsvps WHERE event_id = ? AND status = 'yes'")
    .bind(event.id)
    .first()

  return ok({ rsvp: { guests: agg.guests, replies: agg.replies }, status })
}
