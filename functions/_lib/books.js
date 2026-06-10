// Pure books math + CSV building (no I/O — unit-tested in scripts/test-money.mjs).
// All amounts are integer minor units (pesewas) unless a name says otherwise.

/** Sum expense lines by status. */
export function expenseTotals(expenses = []) {
  const out = { planned: 0, committed: 0, paid: 0, total: 0 }
  for (const e of expenses) {
    const amt = Number(e?.amount) || 0
    if (e?.status in out) out[e.status] += amt
    out.total += amt
  }
  return out
}

/**
 * One event's books. projectedMargin assumes every cost line lands;
 * actualMargin is money in minus money actually out.
 */
export function bookSummary({ estimateMinor = 0, collectedMinor = 0, expenses = [] }) {
  const costs = expenseTotals(expenses)
  return {
    estimate: estimateMinor,
    collected: collectedMinor,
    outstanding: Math.max(0, estimateMinor - collectedMinor),
    costs,
    projectedMargin: estimateMinor - costs.total,
    actualMargin: collectedMinor - costs.paid,
  }
}

const csvCell = (v) => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** RFC-4180-style CSV (CRLF rows, quoted only when needed). */
export function toCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}
