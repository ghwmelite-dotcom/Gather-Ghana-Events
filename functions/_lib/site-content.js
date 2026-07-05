// Helpers for editable site content (process, FAQ, testimonials).

export const CONTENT_TYPES = ['process', 'faq', 'testimonial']

/** Parse a site_content.data JSON column into a plain object (or {} on bad input). */
export function parseData(str) {
  try {
    const v = JSON.parse(str)
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch {
    return {}
  }
}

/** Group ordered rows into { process, faq, testimonial } with data merged in. */
export function groupContent(rows) {
  const out = { process: [], faq: [], testimonial: [] }
  for (const r of rows) {
    if (!CONTENT_TYPES.includes(r.type)) continue
    out[r.type].push({ id: r.id, ...parseData(r.data), sort: r.sort, published: r.published === 1 })
  }
  return out
}
