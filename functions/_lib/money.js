// Money is always stored and passed as integer MINOR units (pesewas/cents).
// Never use floats for money. Display formatting happens at the edges only.

export const CURRENCIES = {
  GHS: { symbol: 'GH₵', decimals: 2, name: 'Ghana Cedi' },
  USD: { symbol: '$', decimals: 2, name: 'US Dollar' },
  GBP: { symbol: '£', decimals: 2, name: 'British Pound' },
  EUR: { symbol: '€', decimals: 2, name: 'Euro' },
  NGN: { symbol: '₦', decimals: 2, name: 'Nigerian Naira' },
}

export const isCurrency = (c) => Object.prototype.hasOwnProperty.call(CURRENCIES, c)

/** Whole units -> minor units (1234 GHS -> 123400). */
export const toMinor = (whole, currency = 'GHS') =>
  Math.round(Number(whole) * 10 ** (CURRENCIES[currency]?.decimals ?? 2))

/** Minor units -> whole-unit number. */
export const fromMinor = (minor, currency = 'GHS') =>
  Number(minor) / 10 ** (CURRENCIES[currency]?.decimals ?? 2)

/** Format minor units for display, e.g. formatMoney(1840000,'GHS') -> "GH₵ 18,400". */
export function formatMoney(minor, currency = 'GHS', { cents = false } = {}) {
  const meta = CURRENCIES[currency] || CURRENCIES.GHS
  const value = fromMinor(minor, currency)
  const str = value.toLocaleString('en', {
    minimumFractionDigits: cents ? meta.decimals : 0,
    maximumFractionDigits: cents ? meta.decimals : 0,
  })
  return `${meta.symbol} ${str}`
}

// Platform fee model (basis points). Applied at payment initialization.
export const FEES_BPS = {
  contribution: 250, // 2.5% on contribution pools
  escrow: 150, // 1.5% on escrowed milestone funding
  fx: 200, // +2% spread on cross-border (display/settlement note)
}

/** Fee in minor units for a given amount + kind. */
export const feeMinor = (minor, kind) =>
  Math.round((Number(minor) * (FEES_BPS[kind] || 0)) / 10000)
