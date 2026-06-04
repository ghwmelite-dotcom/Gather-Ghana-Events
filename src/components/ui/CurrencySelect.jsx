import { CURRENCY_CODES, CURRENCIES } from '../../lib/money.js'
import { useCurrency } from '../../lib/CurrencyContext.jsx'

/** Compact currency switcher for the diaspora bridge. `tone` adapts to dark headers. */
export default function CurrencySelect({ tone = 'dark', className = '' }) {
  const { currency, setCurrency } = useCurrency()
  const text = tone === 'light' ? 'text-cream/80 border-cream/30' : 'text-plum/80 border-plum/25'
  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span className="sr-only">Display currency</span>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        className={`appearance-none bg-transparent border rounded-full pl-3 pr-7 py-1.5 text-sm cursor-pointer ${text} focus-visible:outline-champagne`}
      >
        {CURRENCY_CODES.map((c) => (
          <option key={c} value={c} className="text-ink">
            {CURRENCIES[c].flag} {c}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-2 w-3.5 h-3.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </label>
  )
}
