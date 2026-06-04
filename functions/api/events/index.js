// POST /api/events — create a shareable event (auth: a signed-in planner/client).

import { ok, fail, readJson } from '../../_lib/respond.js'
import { uid, now, clampStr } from '../../_lib/util.js'
import { currentClientId } from '../../_lib/auth.js'
import { isCurrency } from '../../_lib/money.js'

const slugify = (s) =>
  clampStr(s, 60)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'event'

const VISIBILITY = ['public', 'unlisted', 'private']

export async function onRequestPost({ request, env }) {
  const clientId = await currentClientId(request, env)
  if (!clientId) return fail('Not signed in', 401)

  const db = env.DB
  const owner = await db.prepare('SELECT email FROM clients WHERE id = ?').bind(clientId).first()

  const body = await readJson(request)
  const title = clampStr(body.title, 120)
  if (!title) return fail('A title is required', 422, { fields: { title: 'Title is required' } })

  const currency = isCurrency(body.currency) ? body.currency : 'GHS'
  const visibility = VISIBILITY.includes(body.visibility) ? body.visibility : 'public'
  const goal = Math.max(0, Math.round(Number(body.contribution_goal) || 0)) // minor units

  // Unique slug (append a short suffix to avoid collisions).
  const slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`
  const id = uid('evt_')
  const ts = now()

  await db
    .prepare(
      `INSERT INTO events
       (id, slug, owner_email, inquiry_id, title, host_names, event_type, event_date,
        start_time, venue, location, cover_image, story, currency, visibility,
        rsvp_enabled, contributions_enabled, contribution_goal, livestream_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id, slug, owner?.email || null, clampStr(body.inquiry_id, 60) || null,
      title, clampStr(body.host_names, 160), clampStr(body.event_type, 40),
      clampStr(body.event_date, 20), clampStr(body.start_time, 20),
      clampStr(body.venue, 160), clampStr(body.location, 160),
      clampStr(body.cover_image, 400), clampStr(body.story, 4000), currency, visibility,
      body.rsvp_enabled === false ? 0 : 1,
      body.contributions_enabled === false ? 0 : 1,
      goal, clampStr(body.livestream_url, 400), ts
    )
    .run()

  // Optional schedule items.
  if (Array.isArray(body.schedule)) {
    for (const [i, item] of body.schedule.slice(0, 30).entries()) {
      await db
        .prepare('INSERT INTO event_schedule (id, event_id, time, title, description, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(uid('sch_'), id, clampStr(item.time, 20), clampStr(item.title, 120), clampStr(item.description, 500), i, ts)
        .run()
    }
  }

  return ok({ id, slug })
}
