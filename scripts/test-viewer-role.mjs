// Standalone assertions for role helpers (no D1). Run: node scripts/test-viewer-role.mjs
import assert from 'node:assert/strict'
import { roleOf, canWrite } from '../functions/_lib/auth.js'

const env = { ORGANIZER_EMAILS: 'boss@acme.com' }

assert.equal(roleOf(env, { email: 'boss@acme.com', role: 'viewer', is_organizer: 1 }), 'admin')
assert.equal(canWrite(env, { email: 'boss@acme.com', role: 'viewer', is_organizer: 1 }), true)
assert.equal(roleOf(env, { email: 'a@acme.com', role: 'admin', is_organizer: 1 }), 'admin')
assert.equal(canWrite(env, { email: 'a@acme.com', role: 'admin', is_organizer: 1 }), true)
assert.equal(roleOf(env, { email: 'v@acme.com', role: 'viewer', is_organizer: 1 }), 'viewer')
assert.equal(canWrite(env, { email: 'v@acme.com', role: 'viewer', is_organizer: 1 }), false)
assert.equal(roleOf(env, { email: 'a@acme.com', role: null, is_organizer: 1 }), 'admin')
assert.equal(canWrite(env, { email: 'x@acme.com', role: 'admin', is_organizer: 0 }), false)

console.log('OK: role helper assertions passed')
