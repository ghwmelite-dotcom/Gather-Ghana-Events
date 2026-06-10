// Seed believable demo data on production via the real APIs.
// Usage: node scripts/seed-demo.mjs <magic-link-token>
// The token must already exist (hashed) in auth_tokens for the admin client —
// see docs/demo/demo-walkthrough.md prep notes.

const SITE = 'https://gge.ohwpstudios.org'
const token = process.argv[2]
if (!token) { console.error('usage: node scripts/seed-demo.mjs <token>'); process.exit(1) }

let cookie = ''
async function call(path, body, { auth = true, method = 'POST' } = {}) {
  const res = await fetch(`${SITE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth && cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(data)}`)
  return data
}

// ---- 1) Sign in as the admin organizer ----
{
  const res = await fetch(`${SITE}/api/auth/verify`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  const data = await res.json()
  if (!res.ok || !data.ok) throw new Error(`verify failed: ${JSON.stringify(data)}`)
  cookie = (res.headers.get('set-cookie') || '').split(';')[0]
  console.log(`signed in as ${data.client.email} (organizer: ${data.client.isOrganizer})`)
}

// ---- 2) Two believable leads via the public Book form ----
const wedding = await call('/inquiries', {
  name: 'Ama & Kojo Mensah', email: 'ohwpstudios+amakojo@gmail.com', phone: '+233244123456',
  type: 'Wedding', date: '2026-08-15', guests: 250, estimate: 85000,
  notes: 'Traditional engagement in Kumasi, then white wedding + reception at Aburi Gardens. Kente + champagne theme. Diaspora family joining from London & Atlanta.',
}, { auth: false })
console.log('lead: Ama & Kojo Mensah (wedding)', wedding.inquiryId)

const birthday = await call('/inquiries', {
  name: 'Efua Asante', email: 'ohwpstudios+efua@gmail.com', phone: '+233209876543',
  type: 'Birthday', date: '2026-07-18', guests: 80, estimate: 22000,
  notes: 'Golden Jubilee — 50th birthday dinner. Elegant plum & gold, live highlife band, surprise tribute video.',
}, { auth: false })
console.log('lead: Efua Asante (50th birthday)', birthday.inquiryId)

const W = wedding.inquiryId, B = birthday.inquiryId

// ---- 3) Proposals + lead statuses ----
await call('/org/proposals', { inquiryId: W, title: 'Full planning & styling — Mensah wedding', amount: 85000, body: 'End-to-end planning: traditional engagement, white wedding, reception styling, vendor management, on-the-day coordination.' })
await call('/org/inquiry', { inquiryId: W, status: 'booked' })
console.log('wedding: proposal sent, status -> booked')

await call('/org/proposals', { inquiryId: B, title: 'Golden Jubilee package', amount: 22000, body: 'Venue styling, catering coordination, band booking, MC, and tribute video production.' })
await call('/org/inquiry', { inquiryId: B, status: 'quoted' })
console.log('birthday: proposal sent, status -> quoted')

// ---- 4) Milestones on the wedding (one funded in escrow, one done) ----
const m1 = await call('/org/milestones', { action: 'upsert', inquiryId: W, title: 'Venue & vendor confirmations', due_date: '2026-06-20', amount: 15000, status: 'in_progress', sort: 1 })
await call('/org/milestones', { action: 'fund', id: m1.id })
await call('/org/milestones', { action: 'upsert', inquiryId: W, title: 'Traditional engagement (knocking & rites)', due_date: '2026-07-25', amount: 25000, status: 'upcoming', sort: 2 })
await call('/org/milestones', { action: 'upsert', inquiryId: W, title: 'Mood board & styling concept', due_date: '2026-06-05', amount: 0, status: 'done', sort: 0 })
console.log('wedding: 3 milestones (GH₵ 15,000 funded in escrow)')

// ---- 5) Team tasks: one overdue, ones due soon, one done, one general ----
await call('/org/tasks', { action: 'create', inquiryId: W, title: 'Call Aburi Gardens to confirm 15 Aug availability', assignee_email: 'ohwpstudios@gmail.com', due_date: '2026-06-09', notes: 'Ask about rain contingency marquee' })
await call('/org/tasks', { action: 'create', inquiryId: W, title: 'Send catering menu options to Ama', assignee_email: 'ohwpstudios@gmail.com', due_date: '2026-06-12' })
await call('/org/tasks', { action: 'create', inquiryId: W, title: 'Book photographer for engagement shoot', due_date: '2026-06-20' })
const tDone = await call('/org/tasks', { action: 'create', inquiryId: W, title: 'Share mood board with Ama & Kojo', assignee_email: 'ohwpstudios@gmail.com', due_date: '2026-06-08' })
await call('/org/tasks', { action: 'set_status', id: tDone.id, status: 'done' })
await call('/org/tasks', { action: 'create', inquiryId: B, title: 'Chase DJ & band quotes for Jubilee', assignee_email: 'ohwpstudios@gmail.com', due_date: '2026-06-14' })
await call('/org/tasks', { action: 'create', title: 'Renew studio liability insurance', due_date: '2026-06-30', notes: 'General — not tied to an event' })
console.log('tasks: 6 created (1 overdue, 1 done, 1 general)')

// ---- 6) Expenses across categories & statuses ----
await call('/org/expenses', { action: 'create', inquiryId: W, category: 'venue', vendor_name: 'Aburi Gardens', description: 'Venue hire + garden ceremony setup', amount: 18000, status: 'committed' })
await call('/org/expenses', { action: 'create', inquiryId: W, category: 'catering', vendor_name: 'Auntie Muni Catering', description: '250 covers, jollof + continental', amount: 21500, status: 'committed' })
await call('/org/expenses', { action: 'create', inquiryId: W, category: 'decor', vendor_name: 'Bloom & Co. Florals', description: 'Florals, arch & centerpieces', amount: 6400, status: 'planned' })
await call('/org/expenses', { action: 'create', inquiryId: W, category: 'photography', vendor_name: 'Kofi Lens Studios', description: 'Engagement + wedding day package', amount: 7500, status: 'paid' })
await call('/org/expenses', { action: 'create', inquiryId: W, category: 'transport', description: 'Guest shuttle — 2 coaches, Accra ↔ Aburi', amount: 2800, status: 'planned' })
await call('/org/expenses', { action: 'create', inquiryId: B, category: 'catering', vendor_name: 'Jubilee Caterers', description: '80-cover dinner buffet', amount: 6800, status: 'planned' })
await call('/org/expenses', { action: 'create', category: 'fees', description: 'Paystack & bank charges — May', amount: 420, status: 'paid' })
console.log('expenses: 7 created (planned/committed/paid mix)')

// ---- 7) Show the resulting books ----
const books = await call('/org/books', null, { method: 'GET' })
const ghs = (m) => 'GH₵ ' + (m / 100).toLocaleString()
console.log('\nBOOKS NOW:')
for (const e of books.events) {
  console.log(`  ${e.name} (${e.event_type}): estimate ${ghs(e.estimate)} | costs ${ghs(e.costs.total)} | projected margin ${ghs(e.projectedMargin)}`)
}
console.log(`  totals: collected ${ghs(books.totals.collected)} | costs paid ${ghs(books.totals.costsPaid)} | escrow held ${ghs(books.totals.escrowHeld)}`)
console.log('\nDemo data seeded. Pages to check: /org, /org/tasks, /org/books, /org/clients/' + W)
