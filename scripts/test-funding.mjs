// Run: node scripts/test-funding.mjs
import assert from 'node:assert/strict'
import { lineItemsFromQuote, progressPct } from '../functions/_lib/funding.js'

// --- lineItemsFromQuote ---
assert.deepEqual(lineItemsFromQuote('not json'), [])
assert.deepEqual(lineItemsFromQuote('{"a":1}'), [])   // object, not array
assert.deepEqual(lineItemsFromQuote([]), [])
const items = lineItemsFromQuote(JSON.stringify([
  { label: 'Venue & catering', amount: 4000 },
  { label: '   ', amount: 100 },               // blank label → dropped
  { label: 'Décor', amount: 2000, key: 'decor' },
]))
assert.equal(items.length, 2)
assert.deepEqual(items[0], { label: 'Venue & catering', category_key: null, target_amount: 400000 })
assert.equal(items[1].category_key, 'decor')
assert.equal(items[1].target_amount, 200000)   // whole cedis → pesewas

// --- progressPct ---
assert.equal(progressPct(0, 0), null)          // no target
assert.equal(progressPct(100, 0), null)
assert.equal(progressPct(50000, 100000), 50)
assert.equal(progressPct(150000, 100000), 100) // capped at 100
assert.equal(progressPct(0, 100000), 0)

console.log('OK: funding helper assertions passed')
