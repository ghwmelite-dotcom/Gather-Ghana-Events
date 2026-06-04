import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from './api.js'
import { CURRENCIES, FALLBACK_RATES, formatMoney, toMinor, convertFromGhs } from './money.js'

const Ctx = createContext(null)

const read = () => {
  try {
    const c = localStorage.getItem('gge_currency')
    return c && CURRENCIES[c] ? c : 'GHS'
  } catch {
    return 'GHS'
  }
}

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(read)
  const [rates, setRates] = useState(FALLBACK_RATES)

  useEffect(() => {
    api.fx().then((r) => r?.rates && setRates(r.rates)).catch(() => {})
  }, [])

  const setCurrency = useCallback((c) => {
    if (!CURRENCIES[c]) return
    setCurrencyState(c)
    try { localStorage.setItem('gge_currency', c) } catch { /* noop */ }
  }, [])

  // Format a whole-GHS amount in the currently selected currency.
  const fmtGhs = useCallback(
    (wholeGhs) => formatMoney(toMinor(convertFromGhs(wholeGhs, currency, rates), currency), currency),
    [currency, rates]
  )

  return (
    <Ctx.Provider value={{ currency, setCurrency, rates, fmtGhs, isForeign: currency !== 'GHS' }}>
      {children}
    </Ctx.Provider>
  )
}

export function useCurrency() {
  return (
    useContext(Ctx) || {
      currency: 'GHS',
      setCurrency: () => {},
      rates: FALLBACK_RATES,
      fmtGhs: (w) => formatMoney(toMinor(w, 'GHS'), 'GHS'),
      isForeign: false,
    }
  )
}
