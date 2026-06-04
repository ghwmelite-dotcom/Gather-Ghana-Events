// Pure-logic unit tests for money/fx/escrow. Run: node scripts/test-money.mjs
import assert from 'node:assert/strict'
import { toMinor, fromMinor, formatMoney, feeMinor } from '../functions/_lib/money.js'
import { convertMinor } from '../functions/_lib/fx.js'
import { applyAction, canTransition, escrowTotals } from '../functions/_lib/escrow.js'
import { schedule } from '../functions/_lib/financing.js'

let n = 0
const t = (name, fn) => { fn(); n++; console.log('  ok', name) }

console.log('money')
t('toMinor', () => assert.equal(toMinor(1234, 'GHS'), 123400))
t('fromMinor', () => assert.equal(fromMinor(123400, 'GHS'), 1234))
t('formatMoney whole', () => assert.equal(formatMoney(1840000, 'GHS'), 'GH₵ 18,400'))
t('formatMoney usd', () => assert.equal(formatMoney(150000, 'USD'), '$ 1,500'))
t('feeMinor 2.5%', () => assert.equal(feeMinor(100000, 'contribution'), 2500))

console.log('fx')
t('USD->GHS', () => assert.equal(convertMinor(10000, 'USD', 'GHS'), 150000))
t('GHS->USD', () => assert.equal(convertMinor(150000, 'GHS', 'USD'), 10000))
t('same currency', () => assert.equal(convertMinor(999, 'GHS', 'GHS'), 999))

console.log('escrow')
t('fund from none', () => assert.equal(applyAction('none', 'fund'), 'funded'))
t('approve from funded', () => assert.equal(applyAction('funded', 'approve'), 'released'))
t('cannot approve released', () => assert.equal(applyAction('released', 'approve'), null))
t('canTransition', () => assert.equal(canTransition('funded', 'released'), true))
t('totals', () => assert.deepEqual(
  escrowTotals([
    { escrow_status: 'funded', amount: 100 },
    { escrow_status: 'release_requested', amount: 50 },
    { escrow_status: 'released', amount: 200 },
    { escrow_status: 'none', amount: 999 },
  ]),
  { held: 150, released: 200 }
))

console.log('financing')
t('deposit 30%', () => assert.equal(schedule(100000, 6).deposit, 30000))
t('installments sum to financed', () => {
  const s = schedule(100000, 6)
  assert.equal(s.installments.reduce((a, i) => a + i.amount, 0), s.financed)
})
t('rounding exact', () => {
  const s = schedule(100001, 7) // financed 70001 over 7 -> no cents lost
  assert.equal(s.installments.reduce((a, i) => a + i.amount, 0), s.financed)
})
t('months clamped', () => assert.equal(schedule(50000, 99).months, 24))

console.log(`\n${n} tests passed`)
