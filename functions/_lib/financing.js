// "Plan now, pay over time" — pure installment schedule math (minor units).
// No interest by default (MoMo-friendly); set aprBps for a financing fee.

export function schedule(totalMinor, months, { depositPct = 30, aprBps = 0, startTs = 0 } = {}) {
  const m = Math.max(1, Math.min(24, Math.floor(months)))
  const total = Math.max(0, Math.round(totalMinor))
  const deposit = Math.round((total * depositPct) / 100)
  const financed = total - deposit
  const fee = Math.round((financed * aprBps) / 10000)
  const payable = financed + fee

  const base = Math.floor(payable / m)
  const remainder = payable - base * m
  const installments = []
  for (let i = 0; i < m; i++) {
    const amount = base + (i < remainder ? 1 : 0) // distribute rounding to earliest
    installments.push({
      n: i + 1,
      amount,
      dueTs: startTs ? startTs + (i + 1) * 30 * 86400000 : null,
    })
  }
  return { total, deposit, financed, fee, months: m, installments, totalPayable: deposit + payable }
}
