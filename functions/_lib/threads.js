// Pure thread helpers (no I/O — unit-tested in scripts/test-money.mjs).

/** Count client-sent messages the organizer hasn't seen, grouped by inquiry. */
export function unreadCounts(rows = []) {
  const byInquiry = {}
  let total = 0
  for (const r of rows) {
    if (r?.sender_role !== 'client' || r?.read_by_org) continue
    byInquiry[r.inquiry_id] = (byInquiry[r.inquiry_id] || 0) + 1
    total++
  }
  return { byInquiry, total }
}
