// Pure logic for the custom package builder: priority reweighting, label→category
// mapping, and human-readable summaries. No I/O — unit-tested via scripts/test-packages.mjs.

export const PRIORITY_KEYS = ['venue', 'catering', 'decor', 'photography', 'music', 'beauty']

/** All canonical priority keys a budget-split label touches (a combined line yields several). */
export function labelToKeys(label) {
  const s = String(label).toLowerCase()
  const keys = []
  if (s.includes('venue')) keys.push('venue')
  if (s.includes('cater')) keys.push('catering')
  if (/décor|decor|floral|styl|theme|stage/.test(s)) keys.push('decor')
  if (s.includes('photo')) keys.push('photography')
  if (/music|entertain/.test(s)) keys.push('music')
  if (/attire|beauty|makeup/.test(s)) keys.push('beauty')
  return keys
}

/** Marketplace vendor categories that serve a canonical key ('beauty' → DB 'makeup'). */
export function vendorCategoriesForKey(key) {
  return {
    venue: ['venue'], catering: ['catering'], decor: ['decor'],
    photography: ['photography'], music: ['music'], beauty: ['makeup'],
  }[key] || []
}

/**
 * Reweight a [{label, pct}] split toward prioritized categories.
 * Prioritized lines get their pct multiplied by `boost`; then all are renormalized to
 * sum exactly 100 (integers), with rounding drift absorbed by the largest line.
 * Returns [{label, pct}] (caller recomputes amounts from budget).
 */
export function reweightSplit(split, priorities = [], boost = 1.6) {
  const pris = new Set((priorities || []).filter((k) => PRIORITY_KEYS.includes(k)))
  const weighted = split.map((s) => {
    const isPri = labelToKeys(s.label).some((k) => pris.has(k))
    return { label: s.label, w: s.pct * (isPri ? boost : 1) }
  })
  const totalW = weighted.reduce((a, s) => a + s.w, 0) || 1
  const out = weighted.map((s) => ({ label: s.label, pct: Math.round((s.w / totalW) * 100) }))
  const drift = 100 - out.reduce((a, s) => a + s.pct, 0)
  if (drift !== 0 && out.length) {
    let maxIdx = 0
    out.forEach((s, i) => { if (s.pct > out[maxIdx].pct) maxIdx = i })
    out[maxIdx].pct += drift
  }
  return out
}

/** Human-readable package summary for inquiry notes + WhatsApp text. */
export function packageSummary({ type, guests, budget, perGuest, priorities, split, label }) {
  const lines = split.map((s) => ` • ${s.label}: GHS ${Number(s.amount).toLocaleString()}`).join('\n')
  const pri = priorities && priorities.length ? priorities.join(', ') : 'none'
  return (
    `Custom package request\n` +
    `Event: ${label || type}\n` +
    `Guests: ${guests}\n` +
    `Budget: GHS ${Number(budget).toLocaleString()} (~GHS ${Number(perGuest).toLocaleString()}/guest)\n` +
    `Priorities: ${pri}\n` +
    `Breakdown:\n${lines}`
  )
}
