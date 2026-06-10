// GET /api/org/books — the money picture across every event.
//   (no params)                       -> { totals, events }  (all amounts minor units)
//   ?export=events|payments|expenses  -> text/csv attachment (amounts in GH₵ for spreadsheets)

import { json, fail } from '../../_lib/respond.js'
import { currentOrganizer } from '../../_lib/auth.js'
import { toMinor, fromMinor } from '../../_lib/money.js'
import { expenseTotals, bookSummary, toCsv } from '../../_lib/books.js'

const day = (ts) => (ts ? new Date(ts).toISOString().slice(0, 10) : '')

async function loadBooks(db) {
  const [inquiries, payments, expenses, escrowAgg] = await Promise.all([
    db.prepare(`SELECT i.id, i.event_type, i.event_date, i.status, i.estimate, c.name, c.email
                FROM inquiries i JOIN clients c ON c.id = i.client_id
                ORDER BY i.created_at DESC`).all(),
    db.prepare(`SELECT inquiry_id, reference, amount, currency, status, channel, purpose, paid_at, created_at
                FROM payments ORDER BY created_at DESC`).all(),
    db.prepare(`SELECT id, inquiry_id, vendor_name, category, description, amount, currency, status, paid_at, created_at
                FROM expenses ORDER BY created_at DESC`).all(),
    db.prepare(`SELECT COALESCE(SUM(amount),0) AS held FROM timeline_events
                WHERE escrow_status IN ('funded','release_requested')`).first(),
  ])
  return { inquiries: inquiries.results, payments: payments.results, expenses: expenses.results, escrowHeld: escrowAgg.held }
}

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const { inquiries, payments, expenses, escrowHeld } = await loadBooks(env.DB)

  const paidByInquiry = new Map()
  for (const p of payments) {
    if (p.status !== 'success' || !p.inquiry_id) continue
    paidByInquiry.set(p.inquiry_id, (paidByInquiry.get(p.inquiry_id) || 0) + p.amount)
  }
  const expByInquiry = new Map()
  const generalExpenses = []
  for (const e of expenses) {
    if (!e.inquiry_id) { generalExpenses.push(e); continue }
    if (!expByInquiry.has(e.inquiry_id)) expByInquiry.set(e.inquiry_id, [])
    expByInquiry.get(e.inquiry_id).push(e)
  }

  const events = inquiries.map((i) => ({
    inquiry_id: i.id, name: i.name, event_type: i.event_type, event_date: i.event_date, status: i.status,
    ...bookSummary({
      estimateMinor: toMinor(i.estimate || 0, 'GHS'),       // legacy column is whole cedis
      collectedMinor: paidByInquiry.get(i.id) || 0,
      expenses: expByInquiry.get(i.id) || [],
    }),
  }))

  const url = new URL(request.url)
  const exp = url.searchParams.get('export')
  if (exp) return exportCsv(exp, { events, payments, expenses, inquiries })

  const generalCosts = expenseTotals(generalExpenses)
  const totals = events.reduce(
    (acc, e) => ({
      estimate: acc.estimate + e.estimate,
      collected: acc.collected + e.collected,
      outstanding: acc.outstanding + e.outstanding,
      costsPaid: acc.costsPaid + e.costs.paid,
      costsCommitted: acc.costsCommitted + e.costs.committed,
      costsPlanned: acc.costsPlanned + e.costs.planned,
      projectedMargin: acc.projectedMargin + e.projectedMargin,
      actualMargin: acc.actualMargin + e.actualMargin,
    }),
    { estimate: 0, collected: 0, outstanding: 0, costsPaid: 0, costsCommitted: 0, costsPlanned: 0, projectedMargin: 0, actualMargin: 0 }
  )
  totals.costsPaid += generalCosts.paid
  totals.costsCommitted += generalCosts.committed
  totals.costsPlanned += generalCosts.planned
  totals.projectedMargin -= generalCosts.total
  totals.actualMargin -= generalCosts.paid
  totals.escrowHeld = escrowHeld
  totals.generalCosts = generalCosts

  return json({ ok: true, totals, events })
}

function exportCsv(kind, { events, payments, expenses, inquiries }) {
  const clientOf = new Map(inquiries.map((i) => [i.id, i.name]))
  const ghs = (minor) => fromMinor(minor || 0, 'GHS')
  let headers, rows

  if (kind === 'events') {
    headers = ['Client', 'Event type', 'Event date', 'Status', 'Estimate (GHS)', 'Collected (GHS)', 'Outstanding (GHS)',
      'Costs planned (GHS)', 'Costs committed (GHS)', 'Costs paid (GHS)', 'Projected margin (GHS)', 'Actual margin (GHS)']
    rows = events.map((e) => [e.name, e.event_type, e.event_date, e.status, ghs(e.estimate), ghs(e.collected), ghs(e.outstanding),
      ghs(e.costs.planned), ghs(e.costs.committed), ghs(e.costs.paid), ghs(e.projectedMargin), ghs(e.actualMargin)])
  } else if (kind === 'payments') {
    headers = ['Client', 'Reference', 'Purpose', 'Amount (GHS)', 'Status', 'Channel', 'Paid at', 'Created at']
    rows = payments.map((p) => [clientOf.get(p.inquiry_id) || '', p.reference, p.purpose, ghs(p.amount), p.status, p.channel, day(p.paid_at), day(p.created_at)])
  } else if (kind === 'expenses') {
    headers = ['Client', 'Vendor', 'Category', 'Description', 'Amount (GHS)', 'Status', 'Paid at', 'Created at']
    rows = expenses.map((e) => [clientOf.get(e.inquiry_id) || 'General', e.vendor_name, e.category, e.description, ghs(e.amount), e.status, day(e.paid_at), day(e.created_at)])
  } else {
    return fail('Unknown export — use events, payments, or expenses', 422)
  }

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return new Response(toCsv(headers, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="gge-${kind}-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
