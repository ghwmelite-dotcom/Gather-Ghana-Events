// Helpers for the services catalog.

/** Safely parse a services.features JSON column into an array of non-empty strings. */
export function parseFeatures(str) {
  try {
    const v = JSON.parse(str)
    if (!Array.isArray(v)) return []
    return v.map((x) => (x == null ? '' : String(x))).filter(Boolean)
  } catch {
    return []
  }
}
