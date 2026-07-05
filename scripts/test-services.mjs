// Run: node scripts/test-services.mjs
import assert from 'node:assert/strict'
import { parseFeatures } from '../functions/_lib/services.js'

assert.deepEqual(parseFeatures('["a","b"]'), ['a', 'b'])
assert.deepEqual(parseFeatures('not json'), [])
assert.deepEqual(parseFeatures('{"a":1}'), [])       // non-array → []
assert.deepEqual(parseFeatures('[1,2]'), ['1', '2']) // coerced to strings
assert.deepEqual(parseFeatures(null), [])
assert.deepEqual(parseFeatures('["x","",null]'), ['x']) // blanks/nullish dropped

console.log('OK: services helper assertions passed')
