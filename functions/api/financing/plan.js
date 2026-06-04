// POST /api/financing/plan { amount (whole GHS), months } -> installment schedule.

import { ok, readJson } from '../../_lib/respond.js'
import { toMinor } from '../../_lib/money.js'
import { schedule } from '../../_lib/financing.js'

export async function onRequestPost({ request, env }) {
  const body = await readJson(request)
  const amountMinor = toMinor(Math.max(0, parseFloat(body.amount) || 0), 'GHS')
  const months = Math.max(1, Math.min(24, parseInt(body.months) || 6))
  const aprBps = parseInt(env.FINANCING_APR_BPS) || 0
  return ok({ plan: schedule(amountMinor, months, { depositPct: 30, aprBps }) })
}
