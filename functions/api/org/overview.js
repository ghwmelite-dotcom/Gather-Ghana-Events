// GET /api/org/overview — organizer dashboard data (auth: organizer only).

import { json, fail } from '../../_lib/respond.js'
import { currentOrganizer } from '../../_lib/auth.js'

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const db = env.DB

  const [leadCount, eventCount, contribAgg, escrowAgg, leads, events, msgs] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS n FROM inquiries').first(),
    db.prepare('SELECT COUNT(*) AS n FROM events').first(),
    db.prepare("SELECT COALESCE(SUM(amount),0) AS raised, COUNT(*) AS gifts FROM contributions WHERE status='success'").first(),
    db.prepare("SELECT COALESCE(SUM(amount),0) AS held FROM timeline_events WHERE escrow_status IN ('funded','release_requested')").first(),
    db.prepare(`SELECT i.id, i.event_type, i.event_date, i.guests, i.estimate, i.status, i.created_at,
                       c.name, c.email, c.phone
                FROM inquiries i JOIN clients c ON c.id = i.client_id
                ORDER BY i.created_at DESC LIMIT 25`).all(),
    db.prepare('SELECT slug, title, host_names, event_date, visibility FROM events ORDER BY created_at DESC LIMIT 25').all(),
    db.prepare('SELECT id, name, email, body, status, created_at FROM messages ORDER BY created_at DESC LIMIT 10').all(),
  ])

  return json({
    ok: true,
    organizer: { name: org.name, email: org.email },
    stats: {
      leads: leadCount.n,
      events: eventCount.n,
      contributionsRaised: contribAgg.raised, // minor units
      contributionGifts: contribAgg.gifts,
      escrowHeld: escrowAgg.held, // minor units
    },
    leads: leads.results,
    events: events.results,
    messages: msgs.results,
  })
}
