// Pure helpers for line-itemized event funding (Fund-my-Event). No I/O — unit-tested.

/**
 * Map a saved Instant Quote breakdown to funding-line rows.
 * Quote items look like { label, amount(, key) } where `amount` is WHOLE cedis.
 * Returns [{ label, category_key, target_amount }] with target_amount in MINOR units.
 * Returns [] for bad/empty input.
 */
export function lineItemsFromQuote(quoteJson) {
  let arr = quoteJson
  if (typeof quoteJson === 'string') {
    try { arr = JSON.parse(quoteJson) } catch { return [] }
  }
  if (!Array.isArray(arr)) return []
  return arr
    .filter((it) => it && typeof it.label === 'string' && it.label.trim())
    .map((it) => ({
      label: it.label.trim().slice(0, 120),
      category_key: typeof it.key === 'string' ? it.key.slice(0, 40) : null,
      target_amount: Math.max(0, Math.round(Number(it.amount) || 0)) * 100,
    }))
}

/** Progress percent (0..100) of `raised` toward `target`, or null when there is no target. */
export function progressPct(raised, target) {
  if (!target || target <= 0) return null
  return Math.min(100, Math.round(((Number(raised) || 0) / target) * 100))
}
