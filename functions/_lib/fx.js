// Foreign-exchange for DISPLAY pricing (the diaspora bridge). Settlement still
// happens in the planner's account currency (GHS) — we show the shopper their
// home currency and note the charge currency at checkout.
//
// RATES are indicative units of GHS per 1 unit of the currency. Refresh later
// from a live source; kept here so the app works with zero external deps.

export const BASE = 'GHS'

export const RATES_TO_GHS = {
  GHS: 1,
  USD: 15.0,
  GBP: 19.0,
  EUR: 16.2,
  NGN: 0.0095,
}

export const ratesPayload = () => ({
  base: BASE,
  updatedAt: null, // stamped by the route from request time if desired
  rates: RATES_TO_GHS,
})

/**
 * Convert an integer minor-unit amount between currencies (all 2dp here).
 * @returns integer minor units in `to`.
 */
export function convertMinor(minor, from, to) {
  if (from === to) return Math.round(Number(minor))
  const rf = RATES_TO_GHS[from]
  const rt = RATES_TO_GHS[to]
  if (!rf || !rt) return Math.round(Number(minor))
  return Math.round((Number(minor) * rf) / rt)
}
