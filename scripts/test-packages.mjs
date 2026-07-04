// Standalone assertions for package helpers. Run: node scripts/test-packages.mjs
import assert from 'node:assert/strict'
import { PRIORITY_KEYS, labelToKeys, vendorCategoriesForKey, reweightSplit, packageSummary } from '../functions/_lib/packages.js'

// labelToKeys — combined line yields both keys; décor synonyms map to 'decor'.
assert.deepEqual(labelToKeys('Venue & catering'), ['venue', 'catering'])
assert.deepEqual(labelToKeys('Décor, florals & interior styling'), ['decor'])
assert.deepEqual(labelToKeys('Stage, lighting & décor'), ['decor'])
assert.deepEqual(labelToKeys('Photography & film'), ['photography'])
assert.deepEqual(labelToKeys('Attire & beauty'), ['beauty'])
assert.deepEqual(labelToKeys('Music & entertainment'), ['music'])

// vendorCategoriesForKey — beauty maps to the DB 'makeup' category.
assert.deepEqual(vendorCategoriesForKey('beauty'), ['makeup'])
assert.deepEqual(vendorCategoriesForKey('venue'), ['venue'])
assert.deepEqual(vendorCategoriesForKey('nope'), [])

// reweightSplit — with no priorities, percentages are preserved and sum to 100.
const base = [
  { label: 'Venue & catering', pct: 45 },
  { label: 'Décor, florals & interior styling', pct: 20 },
  { label: 'Photography & film', pct: 15 },
  { label: 'Music & entertainment', pct: 10 },
  { label: 'Attire & beauty', pct: 10 },
]
const same = reweightSplit(base, [])
assert.equal(same.reduce((a, s) => a + s.pct, 0), 100)
assert.equal(same.find((s) => s.label === 'Venue & catering').pct, 45)

// reweightSplit — prioritizing photography raises its share; total stays 100.
const pri = reweightSplit(base, ['photography'])
assert.equal(pri.reduce((a, s) => a + s.pct, 0), 100)
assert.ok(pri.find((s) => s.label === 'Photography & film').pct > 15, 'photography boosted')
assert.ok(pri.find((s) => s.label === 'Music & entertainment').pct < 10, 'others trimmed')

// reweightSplit — a priority on a combined line boosts that line.
const priCombined = reweightSplit(base, ['catering'])
assert.ok(priCombined.find((s) => s.label === 'Venue & catering').pct > 45, 'combined line boosted')

// packageSummary — includes the key facts.
const s = packageSummary({ type: 'Wedding', guests: 150, budget: 50000, perGuest: 333, priorities: ['photography'], split: [{ label: 'Photography & film', amount: 12000 }] })
assert.ok(s.includes('Wedding') && s.includes('150') && s.includes('50,000') && s.includes('Photography & film'))

console.log('OK: package helper assertions passed')
