// /api/org/expenses — cost lines per event (or general overhead).
// planned -> committed -> paid; the planned+committed set IS the event budget.
//   GET [?inquiry=<id>]     -> { expenses, categories, inquiries }
//   POST { action, ... }    -> create | update | set_status | delete

import { ok, fail, readJson } from '../../_lib/respond.js'
import { uid, now, clampStr } from '../../_lib/util.js'
import { currentOrganizer, currentEditor } from '../../_lib/auth.js'
import { toMinor, formatMoney } from '../../_lib/money.js'
import { logActivity } from '../../_lib/activity.js'

const CATEGORIES = ['venue', 'catering', 'decor', 'photography', 'music', 'rentals', 'transport', 'staffing', 'fees', 'misc']
const STATUSES = ['planned', 'committed', 'paid']

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const db = env.DB
  const inquiry = clampStr(new URL(request.url).searchParams.get('inquiry'), 60)

  const sql = `
    SELECT e.id, e.inquiry_id, e.vendor_name, e.category, e.description, e.amount, e.currency,
           e.status, e.paid_at, e.receipt_url, e.created_by, e.created_at,
           c.name AS client_name, i.event_type
    FROM expenses e
    LEFT JOIN inquiries i ON i.id = e.inquiry_id
    LEFT JOIN clients c ON c.id = i.client_id
    ${inquiry ? 'WHERE e.inquiry_id = ?' : ''}
    ORDER BY e.created_at DESC LIMIT 500`

  const [expenses, inquiries] = await Promise.all([
    (inquiry ? db.prepare(sql).bind(inquiry) : db.prepare(sql)).all(),
    db.prepare(`SELECT i.id, i.event_type, i.event_date, c.name
                FROM inquiries i JOIN clients c ON c.id = i.client_id
                ORDER BY i.created_at DESC LIMIT 100`).all(),
  ])

  return ok({
    expenses: expenses.results,
    categories: CATEGORIES,
    inquiries: inquiries.results.map((i) => ({ id: i.id, label: `${i.name} · ${i.event_type}${i.event_date ? ` · ${i.event_date}` : ''}` })),
  })
}

export async function onRequestPost({ request, env }) {
  const org = await currentEditor(request, env)
  if (!org) return fail("Read-only access — this action isn't available.", 403)
  const db = env.DB
  const body = await readJson(request)
  const action = body.action

  if (action === 'create') {
    const amount = toMinor(parseFloat(body.amount) || 0, 'GHS')
    const category = CATEGORIES.includes(body.category) ? body.category : 'misc'
    if (amount <= 0) return fail('Amount (GH₵) is required', 422)
    const inquiryId = clampStr(body.inquiryId, 60) || null
    if (inquiryId) {
      const owned = await db.prepare('SELECT id FROM inquiries WHERE id = ?').bind(inquiryId).first()
      if (!owned) return fail('Linked event not found', 404)
    }
    const status = STATUSES.includes(body.status) ? body.status : 'planned'
    const id = uid('exp_')
    await db
      .prepare(
        `INSERT INTO expenses (id, inquiry_id, vendor_name, category, description, amount, currency,
                               status, paid_at, receipt_url, created_by, created_at)
         VALUES (?,?,?,?,?,?,'GHS',?,?,?,?,?)`
      )
      .bind(
        id, inquiryId, clampStr(body.vendor_name, 160) || null, category,
        clampStr(body.description, 500) || null, amount, status,
        status === 'paid' ? now() : null, clampStr(body.receipt_url, 500) || null,
        org.email, now()
      )
      .run()
    await logActivity(db, {
      actor: org.email, action: 'expense.create', entityType: 'expense', entityId: id, inquiryId,
      detail: `Expense ${formatMoney(amount, 'GHS')} (${category}) — ${status}`,
    })
    return ok({ id })
  }

  if (action === 'update') {
    const id = clampStr(body.id, 60)
    const e = await db.prepare('SELECT id FROM expenses WHERE id = ?').bind(id).first()
    if (!e) return fail('Expense not found', 404)
    const amount = toMinor(parseFloat(body.amount) || 0, 'GHS')
    if (amount <= 0) return fail('Amount (GH₵) is required', 422)
    const category = CATEGORIES.includes(body.category) ? body.category : 'misc'
    await db
      .prepare('UPDATE expenses SET vendor_name=?, category=?, description=?, amount=?, receipt_url=? WHERE id=?')
      .bind(
        clampStr(body.vendor_name, 160) || null, category, clampStr(body.description, 500) || null,
        amount, clampStr(body.receipt_url, 500) || null, id
      )
      .run()
    return ok({ id })
  }

  if (action === 'set_status') {
    const id = clampStr(body.id, 60)
    if (!STATUSES.includes(body.status)) return fail('Invalid status', 422)
    const e = await db.prepare('SELECT id, inquiry_id, amount, currency, category FROM expenses WHERE id = ?').bind(id).first()
    if (!e) return fail('Expense not found', 404)
    await db
      .prepare('UPDATE expenses SET status = ?, paid_at = ? WHERE id = ?')
      .bind(body.status, body.status === 'paid' ? now() : null, id)
      .run()
    await logActivity(db, {
      actor: org.email, action: `expense.${body.status}`, entityType: 'expense', entityId: id, inquiryId: e.inquiry_id,
      detail: `Expense ${formatMoney(e.amount, e.currency)} (${e.category}) → ${body.status}`,
    })
    return ok({ id, status: body.status })
  }

  if (action === 'delete') {
    const id = clampStr(body.id, 60)
    const e = await db.prepare('SELECT inquiry_id, amount, currency, category FROM expenses WHERE id = ?').bind(id).first()
    await db.prepare('DELETE FROM expenses WHERE id = ?').bind(id).run()
    if (e) await logActivity(db, {
      actor: org.email, action: 'expense.delete', entityType: 'expense', entityId: id, inquiryId: e.inquiry_id,
      detail: `Expense ${formatMoney(e.amount, e.currency)} (${e.category}) deleted`,
    })
    return ok({ deleted: true })
  }

  return fail('Unknown action', 422)
}
