// GET /api/events/:slug — public event page data (respects visibility).

import { json, fail } from '../../_lib/respond.js'
import { progressPct } from '../../_lib/funding.js'

export async function onRequestGet({ params, env }) {
  const slug = params.slug
  const db = env.DB

  const event = await db
    .prepare(
      `SELECT id, slug, title, host_names, event_type, event_date, start_time, venue,
              location, cover_image, story, currency, visibility, rsvp_enabled,
              contributions_enabled, contribution_goal, livestream_url, self_serve
       FROM events WHERE slug = ?`
    )
    .bind(slug)
    .first()

  if (!event || event.visibility === 'private') return fail('Event not found', 404)

  const [schedule, gallery, rsvpAgg, contribAgg, recent, lines] = await Promise.all([
    db.prepare('SELECT time, title, description FROM event_schedule WHERE event_id = ? ORDER BY sort, time')
      .bind(event.id).all(),
    db.prepare('SELECT url, caption FROM event_gallery WHERE event_id = ? ORDER BY sort')
      .bind(event.id).all(),
    db.prepare("SELECT COALESCE(SUM(party_size),0) AS guests, COUNT(*) AS replies FROM rsvps WHERE event_id = ? AND status = 'yes'")
      .bind(event.id).first(),
    db.prepare("SELECT COALESCE(SUM(amount),0) AS raised, COUNT(*) AS gifts FROM contributions WHERE event_id = ? AND status = 'success'")
      .bind(event.id).first(),
    db.prepare("SELECT CASE WHEN anonymous = 1 THEN NULL ELSE name END AS name, amount, currency, message FROM contributions WHERE event_id = ? AND status = 'success' ORDER BY created_at DESC LIMIT 12")
      .bind(event.id).all(),
    db.prepare(
      `SELECT li.id, li.label, li.target_amount, li.delivery_status, li.sort,
              COALESCE(SUM(CASE WHEN c.status = 'success' THEN c.amount END), 0) AS raised
       FROM event_line_items li
       LEFT JOIN contributions c ON c.line_item_id = li.id
       WHERE li.event_id = ? AND li.visible = 1
       GROUP BY li.id
       ORDER BY li.sort, li.created_at`
    ).bind(event.id).all(),
  ])

  const lineItems = lines.results.map((l) => ({
    id: l.id,
    label: l.label,
    target: l.target_amount,
    raised: l.raised,
    pct: progressPct(l.raised, l.target_amount),
    delivery_status: l.delivery_status,
  }))

  return json({
    ok: true,
    event,
    schedule: schedule.results,
    gallery: gallery.results,
    rsvp: { guests: rsvpAgg.guests, replies: rsvpAgg.replies },
    contributions: {
      raised: contribAgg.raised,
      gifts: contribAgg.gifts,
      goal: event.contribution_goal,
      recent: recent.results,
    },
    lineItems,
  })
}
