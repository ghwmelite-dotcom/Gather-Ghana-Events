// Run: node scripts/test-site-content.mjs
import assert from 'node:assert/strict'
import { parseData, groupContent } from '../functions/_lib/site-content.js'

assert.deepEqual(parseData('{"q":"a","a":"b"}'), { q: 'a', a: 'b' })
assert.deepEqual(parseData('bad'), {})
assert.deepEqual(parseData('[1,2]'), {})   // array → {}
assert.deepEqual(parseData('"x"'), {})     // non-object → {}

const rows = [
  { id: 'p1', type: 'process', data: '{"title":"Discover","desc":"d"}', sort: 1, published: 1 },
  { id: 'f1', type: 'faq', data: '{"q":"Q","a":"A"}', sort: 1, published: 1 },
  { id: 't1', type: 'testimonial', data: '{"quote":"nice","name":"Ama","event":"Wedding"}', sort: 1, published: 0 },
  { id: 'x1', type: 'unknown', data: '{}', sort: 1, published: 1 },
]
const g = groupContent(rows)
assert.deepEqual(Object.keys(g), ['process', 'faq', 'testimonial'])
assert.equal(g.process.length, 1)
assert.equal(g.process[0].title, 'Discover')
assert.equal(g.process[0].id, 'p1')
assert.equal(g.faq[0].q, 'Q')
assert.equal(g.testimonial[0].name, 'Ama')
assert.equal(g.testimonial[0].published, false)

console.log('OK: site-content helper assertions passed')
