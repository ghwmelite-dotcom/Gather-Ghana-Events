// Run: node scripts/test-guide.mjs
// Verifies the role-aware guide helpers map each role to the right sections.
import assert from 'node:assert/strict'
import { GUIDE_GROUPS, GUIDE_ROLES, sectionsForRole, groupsForRole } from '../src/lib/guide.js'

const allSections = GUIDE_GROUPS.flatMap((g) => g.sections)

// Every section is tagged with at least one known role.
const ROLE_IDS = GUIDE_ROLES.map((r) => r.id)
for (const s of allSections) {
  assert.ok(Array.isArray(s.roles) && s.roles.length > 0, `section ${s.id} has no roles`)
  for (const r of s.roles) assert.ok(ROLE_IDS.includes(r), `section ${s.id} has unknown role ${r}`)
}

// No role → the full guide (unchanged public behaviour).
assert.equal(sectionsForRole(null).length, allSections.length)
assert.equal(sectionsForRole('nonsense').length, allSections.length)
assert.equal(groupsForRole(null).length, GUIDE_GROUPS.length)

// Clients see only the client sections, and every one is a cl-* section.
const client = sectionsForRole('client')
assert.equal(client.length, 7)
assert.ok(client.every((s) => s.id.startsWith('cl-')))
assert.deepEqual(groupsForRole('client').map((g) => g.id), ['clients'])

// Full organizers see every organizer section (and no client sections).
const admin = sectionsForRole('admin')
assert.equal(admin.length, 10)
assert.ok(admin.every((s) => s.id.startsWith('org-')))
assert.deepEqual(groupsForRole('admin').map((g) => g.id), ['organizers'])

// View-only members get the read/monitor subset — pages they can browse, including the
// read-only Vendors and Inbox — but NOT the administration pages (Team, Events).
const viewer = sectionsForRole('viewer').map((s) => s.id)
assert.deepEqual(viewer, ['org-signin', 'org-leads', 'org-escrow', 'org-vendors', 'org-inbox', 'org-thread', 'org-tasks', 'org-books'])
for (const readable of ['org-vendors', 'org-inbox']) {
  assert.ok(viewer.includes(readable), `viewer should see the readable page ${readable}`)
}
for (const adminOnly of ['org-team', 'org-events']) {
  assert.ok(!viewer.includes(adminOnly), `viewer should not see admin-only ${adminOnly}`)
}

// The dashboard card drops the "signing in" topic (already authenticated) and caps at 6.
const cardLinks = (role) => sectionsForRole(role).filter((s) => !s.id.endsWith('-signin')).slice(0, 6)
assert.equal(cardLinks('admin').length, 6)
assert.equal(cardLinks('viewer').length, 6)
assert.ok(!cardLinks('admin').some((s) => s.id.endsWith('-signin')))
assert.ok(!cardLinks('viewer').some((s) => s.id.endsWith('-signin')))

console.log('OK: guide role helper assertions passed')
