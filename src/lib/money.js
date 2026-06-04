// Frontend money helpers. Amounts are integer MINOR units (pesewas/cents).
// Mirrors functions/_lib/money.js for consistent display across the app.

export const CURRENCIES = {
  GHS: { symbol: 'GH₵', decimals: 2, name: 'Ghana Cedi', flag: '🇬🇭' },
  USD: { symbol: '$', decimals: 2, name: 'US Dollar', flag: '🇺🇸' },
  GBP: { symbol: '£', decimals: 2, name: 'British Pound', flag: '🇬🇧' },
  EUR: { symbol: '€', decimals: 2, name: 'Euro', flag: '🇪🇺' },
  NGN: { symbol: '₦', decimals: 2, name: 'Nigerian Naira', flag: '🇳🇬' },
}

export const CURRENCY_CODES = Object.keys(CURRENCIES)

export const toMinor = (whole, currency = 'GHS') =>
  Math.round(Number(whole) * 10 ** (CURRENCIES[currency]?.decimals ?? 2))

export const fromMinor = (minor, currency = 'GHS') =>
  Number(minor) / 10 ** (CURRENCIES[currency]?.decimals ?? 2)

export function formatMoney(minor, currency = 'GHS', { cents = false } = {}) {
  const meta = CURRENCIES[currency] || CURRENCIES.GHS
  const value = fromMinor(minor, currency)
  const str = value.toLocaleString('en', {
    minimumFractionDigits: cents ? meta.decimals : 0,
    maximumFractionDigits: cents ? meta.decimals : 0,
  })
  return `${meta.symbol} ${str}`
}

// Indicative fallback rates (GHS per 1 unit of currency) for offline display.
export const FALLBACK_RATES = { GHS: 1, USD: 15.0, GBP: 19.0, EUR: 16.2, NGN: 0.0095 }

/** Convert a GHS amount (any unit) to a target currency. rates = GHS per 1 unit. */
export const convertFromGhs = (amount, currency, rates = FALLBACK_RATES) =>
  Number(amount) / (rates[currency] || 1)
