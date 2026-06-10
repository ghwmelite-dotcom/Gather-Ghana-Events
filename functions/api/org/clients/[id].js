// GET /api/org/clients/:id — full management detail for one inquiry/client.
// (id = inquiry id). Organizer auth.

import { json, fail } from '../../../_lib/respond.js'
import { currentOrganizer } from '../../../_lib/auth.js'
import { escrowTotals } from '../../../_lib/escrow.js'

export async function onRequestGet({ params, request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const db = env.DB
  const id = params.id

  const inquiry = await db
    .prepare(
      `SELECT i.id, i.event_type, i.event_date, i.guests, i.estimate, i.deposit, i.notes, i.status, i.created_at,
              c.id AS client_id, c.name, c.email, c.phone
       FROM inquiries i JOIN clients c ON c.id = i.client_id WHERE i.id = ?`
    )
    .bind(id)
    .first()
  if (!inquiry) return fail('Client not found', 404)

  const [milestones, payments, proposals, events, tasks, expenses, activity] = await Promise.all([
    db.prepare('SELECT id, title, description, due_date, status, sort, amount, currency, escrow_status FROM timeline_events WHERE inquiry_id = ? ORDER BY sort, created_at').bind(id).all(),
    db.prepare('SELECT reference, amount, currency, status, channel, purpose, paid_at, created_at FROM payments WHERE inquiry_id = ? ORDER BY created_at DESC').bind(id).all(),
    db.prepare('SELECT id, title, amount, currency, status, created_at FROM proposals WHERE inquiry_id = ? ORDER BY created_at DESC').bind(id).all(),
    db.prepare('SELECT slug, title, contribution_goal FROM events WHERE inquiry_id = ?').bind(id).all(),
    db.prepare(`SELECT id, title, notes, assignee_email, due_date, status, completed_at, created_at
                FROM tasks WHERE inquiry_id = ?
                ORDER BY (status = 'done'), COALESCE(NULLIF(due_date, ''), '9999'), created_at DESC`).bind(id).all(),
    db.prepare('SELECT id, vendor_name, category, description, amount, currency, status, paid_at, created_at FROM expenses WHERE inquiry_id = ? ORDER BY created_at DESC').bind(id).all(),
    db.prepare('SELECT id, actor_email, action, detail, created_at FROM activity_log WHERE inquiry_id = ? ORDER BY created_at DESC LIMIT 15').bind(id).all(),
  ])

  // Contribution totals for any event(s) tied to this inquiry.
  let contributionsRaised = 0
  for (const e of events.results) {
    const agg = await db
      .prepare("SELECT COALESCE(SUM(amount),0) AS r FROM contributions con JOIN events ev ON ev.id = con.event_id WHERE ev.slug = ? AND con.status='success'")
      .bind(e.slug)
      .first()
    contributionsRaised += agg.r
  }

  return json({
    ok: true,
    inquiry,
    milestones: milestones.results,
    payments: payments.results,
    proposals: proposals.results,
    events: events.results,
    tasks: tasks.results,
    expenses: expenses.results,
    activity: activity.results,
    escrow: escrowTotals(milestones.results),
    contributionsRaised,
  })
}
