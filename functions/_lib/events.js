// Shared creation of a public event-page record. Used by the public (self-serve) and admin endpoints.

import { uid, now, clampStr } from './util.js'
import { isCurrency } from './money.js'

const slugify = (s) =>
  clampStr(s, 60)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'event'

const VISIBILITY = ['public', 'unlisted', 'private']

/**
 * Insert an event (+ optional schedule items) and return { id, slug }.
 * Throws an Error with `.status = 422` and `.fields` when the title is missing.
 */
export async function createEventRecord(db, ownerEmail, body) {
  const title = clampStr(body.title, 120)
  if (!title) {
    const err = new Error('A title is required')
    err.status = 422
    err.fields = { title: 'Title is required' }
    throw err
  }
  const currency = isCurrency(body.currency) ? body.currency : 'GHS'
  const visibility = VISIBILITY.includes(body.visibility) ? body.visibility : 'public'
  const goal = Math.max(0, Math.round(Number(body.contribution_goal) || 0)) // minor units

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
      id, slug, ownerEmail || null, clampStr(body.inquiry_id, 60) || null,
      title, clampStr(body.host_names, 160), clampStr(body.event_type, 40),
      clampStr(body.event_date, 20), clampStr(body.start_time, 20),
      clampStr(body.venue, 160), clampStr(body.location, 160),
      clampStr(body.cover_image, 400), clampStr(body.story, 4000), currency, visibility,
      body.rsvp_enabled === false ? 0 : 1,
      body.contributions_enabled === false ? 0 : 1,
      goal, clampStr(body.livestream_url, 400), ts
    )
    .run()

  if (Array.isArray(body.schedule)) {
    for (const [i, item] of body.schedule.slice(0, 30).entries()) {
      await db
        .prepare('INSERT INTO event_schedule (id, event_id, time, title, description, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(uid('sch_'), id, clampStr(item.time, 20), clampStr(item.title, 120), clampStr(item.description, 500), i, ts)
        .run()
    }
  }
  return { id, slug }
}
