# Org Portal Admin Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three admin capabilities to the organizer portal — vendor catalog CRUD, contact-message replies with status, and DB-backed organizer management — built and deployed in three sequential phases.

**Architecture:** Cloudflare Pages Functions (action-based POST handlers behind a `currentOrganizer` 403 gate) + React/Vite pages under `/org`. D1 changes are additive columns applied via one-off `migrations/*.sql` run against the live DB. Pure helpers are unit-tested in the existing `scripts/test-money.mjs` node harness; endpoints/pages are verified by build + curl + manual round-trip after each deploy.

**Tech Stack:** React 18 + react-router-dom, Tailwind, Cloudflare Pages Functions, D1 (SQLite), Resend (email), wrangler.

**Deploy command (manual — GitHub push does NOT deploy this project):**
```bash
npm run build
CLOUDFLARE_ACCOUNT_ID=ea2eb3a9813660dfca2a60e594858538 npx wrangler pages deploy dist --project-name=gather-ghana-events --commit-dirty=true
```
**Apply a migration to live D1:**
```bash
CLOUDFLARE_ACCOUNT_ID=ea2eb3a9813660dfca2a60e594858538 npx wrangler d1 execute gather-ghana --file=./migrations/<file>.sql --remote
```

---

## PHASE 1 — Vendor management

### Task 1.1: `slugify` helper + unit test

**Files:**
- Modify: `functions/_lib/util.js` (append)
- Modify: `scripts/test-money.mjs`

- [ ] **Step 1: Write the failing test.** Add to `scripts/test-money.mjs` — add the import to the top import block and a new test section before the final summary line.

Add to imports (top of file):
```js
import { slugify } from '../functions/_lib/util.js'
```

Add this section just before the final `console.log(...passed)` line:
```js
console.log('slugify')
t('basic', () => assert.equal(slugify('Bloom & Co. Florals'), 'bloom-co-florals'))
t('trims hyphens', () => assert.equal(slugify('  --Royal Venue--  '), 'royal-venue'))
t('empty', () => assert.equal(slugify(''), ''))
```

- [ ] **Step 2: Run to verify it fails.**

Run: `node scripts/test-money.mjs`
Expected: throws `SyntaxError`/`does not provide an export named 'slugify'` (import fails).

- [ ] **Step 3: Implement `slugify`.** Append to `functions/_lib/util.js`:
```js
/** URL slug: lowercase, non-alphanumerics → single hyphens, trimmed. */
export const slugify = (v) =>
  (typeof v === 'string' ? v : '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
```

- [ ] **Step 4: Run to verify it passes.**

Run: `node scripts/test-money.mjs`
Expected: all tests pass, including the 3 new `slugify` lines.

- [ ] **Step 5: Commit.**
```bash
git add functions/_lib/util.js scripts/test-money.mjs
git commit -m "Add slugify helper + tests"
```

### Task 1.2: Vendor admin API (action-based)

**Files:**
- Modify (replace whole file): `functions/api/org/vendors.js`

- [ ] **Step 1: Replace `functions/api/org/vendors.js` entirely with:**
```js
// /api/org/vendors — organizer-managed vendor catalog.
//   GET                    -> list ALL vendors (incl. unverified)
//   POST { action, ... }   -> create | update | delete | verify

import { ok, json, fail, readJson } from '../../_lib/respond.js'
import { uid, now, clampStr, slugify } from '../../_lib/util.js'
import { currentOrganizer } from '../../_lib/auth.js'
import { toMinor } from '../../_lib/money.js'

const CATEGORIES = ['catering', 'decor', 'venue', 'photography', 'music', 'cake', 'makeup']

// First slug not taken by a DIFFERENT vendor (root, root-2, root-3, …).
async function uniqueSlug(db, base, exceptId = null) {
  const root = slugify(base) || 'vendor'
  let slug = root
  let i = 2
  for (;;) {
    const row = await db.prepare('SELECT id FROM vendors WHERE slug = ?').bind(slug).first()
    if (!row || row.id === exceptId) return slug
    slug = `${root}-${i++}`
  }
}

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const { results } = await env.DB
    .prepare(
      `SELECT id, slug, name, category, location, tagline, about, image, price_from, currency,
              verified, rating, reviews_count, whatsapp, created_at
       FROM vendors ORDER BY created_at DESC`
    )
    .all()
  return json({ ok: true, vendors: results, categories: CATEGORIES })
}

export async function onRequestPost({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const db = env.DB
  const body = await readJson(request)
  const action = body.action

  if (action === 'create') {
    const name = clampStr(body.name, 120)
    const category = clampStr(body.category, 40)
    if (!name || !CATEGORIES.includes(category)) return fail('name and a valid category are required', 422)
    const id = uid('ven_')
    const slug = await uniqueSlug(db, name)
    await db
      .prepare(
        `INSERT INTO vendors (id, slug, name, category, location, tagline, about, image,
                              price_from, currency, verified, rating, reviews_count, whatsapp, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,0,0,?,?)`
      )
      .bind(
        id, slug, name, category,
        clampStr(body.location, 120), clampStr(body.tagline, 200), clampStr(body.about, 2000),
        clampStr(body.image, 500), toMinor(parseFloat(body.price_from) || 0, 'GHS'), 'GHS',
        body.verified ? 1 : 0, clampStr(body.whatsapp, 30), now()
      )
      .run()
    return ok({ id, slug })
  }

  if (action === 'update') {
    const id = clampStr(body.id, 60)
    const existing = await db.prepare('SELECT id, name, slug FROM vendors WHERE id = ?').bind(id).first()
    if (!existing) return fail('Vendor not found', 404)
    const name = clampStr(body.name, 120) || existing.name
    const category = CATEGORIES.includes(body.category) ? body.category : null
    const slug = name !== existing.name ? await uniqueSlug(db, name, id) : existing.slug
    await db
      .prepare(
        `UPDATE vendors SET name=?, slug=?, category=COALESCE(?,category), location=?, tagline=?,
                about=?, image=?, price_from=?, whatsapp=? WHERE id=?`
      )
      .bind(
        name, slug, category,
        clampStr(body.location, 120), clampStr(body.tagline, 200), clampStr(body.about, 2000),
        clampStr(body.image, 500), toMinor(parseFloat(body.price_from) || 0, 'GHS'),
        clampStr(body.whatsapp, 30), id
      )
      .run()
    return ok({ id, slug })
  }

  if (action === 'delete') {
    await db.prepare('DELETE FROM vendors WHERE id = ?').bind(clampStr(body.id, 60)).run()
    return ok({ deleted: true })
  }

  if (action === 'verify') {
    const r = await db
      .prepare('UPDATE vendors SET verified = ? WHERE id = ?')
      .bind(body.verified ? 1 : 0, clampStr(body.id, 60))
      .run()
    if (!r.meta.changes) return fail('Vendor not found', 404)
    return ok({ id: body.id, verified: body.verified ? 1 : 0 })
  }

  return fail('Unknown action', 422)
}
```

- [ ] **Step 2: Build to verify it compiles** (functions are bundled at deploy; a build of the SPA won't catch this, so just lint by eye and rely on the deploy compile in Task 1.6). Run: `npm run build` — Expected: PASS (this file isn't imported by the SPA).

- [ ] **Step 3: Commit.**
```bash
git add functions/api/org/vendors.js
git commit -m "Vendor admin API: list + create/update/delete/verify"
```

### Task 1.3: API client methods

**Files:**
- Modify: `src/lib/api.js` (line 85 `orgVerifyVendor`)

- [ ] **Step 1: Replace the `orgVerifyVendor` line** (`src/lib/api.js:85`) with:
```js
  orgVendors: () => request('/org/vendors'),
  orgVendorAction: (payload) => request('/org/vendors', { method: 'POST', body: payload }),
```

- [ ] **Step 2: Build.** Run: `npm run build` — Expected: PASS.

- [ ] **Step 3: Commit.**
```bash
git add src/lib/api.js
git commit -m "API client: vendor admin methods"
```

### Task 1.4: `OrgVendors` page

**Files:**
- Create: `src/pages/OrgVendors.jsx`

- [ ] **Step 1: Create `src/pages/OrgVendors.jsx`:**
```jsx
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import Field from '../components/ui/Field.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { ArrowLeft, Spinner, Lock, Plus, CheckCircle } from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'
import { formatMoney } from '../lib/money.js'

const BLANK = { name: '', category: 'catering', location: '', tagline: '', about: '', image: '', price_from: '', whatsapp: '' }

export default function OrgVendors() {
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [editId, setEditId] = useState(null)

  const load = useCallback(async () => {
    try { setData(await api.orgVendors()); setState('ok') }
    catch (e) { setState(e instanceof ApiError && (e.status === 403 || e.status === 401) ? 'forbidden' : 'error') }
  }, [])
  useEffect(() => { load() }, [load])

  const run = async (fn) => { setBusy(true); try { await fn() } finally { setBusy(false); await load() } }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const reset = () => { setForm(BLANK); setEditId(null) }

  const save = () => run(async () => {
    await api.orgVendorAction({ action: editId ? 'update' : 'create', id: editId, ...form })
    reset()
  })
  const edit = (v) => {
    setEditId(v.id)
    setForm({
      name: v.name, category: v.category, location: v.location || '', tagline: v.tagline || '',
      about: v.about || '', image: v.image || '', price_from: v.price_from ? v.price_from / 100 : '',
      whatsapp: v.whatsapp || '',
    })
  }

  if (state === 'loading') return <div className="min-h-dvh grid place-items-center text-plum"><Spinner size={32} /></div>
  if (state === 'forbidden') return (
    <Section tone="cream" className="min-h-dvh grid place-items-center"><Container className="text-center max-w-md">
      <Lock size={36} className="text-terracotta mx-auto" />
      <h1 className="font-display text-plum text-3xl mt-4">Organizer access only</h1>
      <Button to="/login" variant="primary" size="md" className="mt-6">Sign in</Button>
    </Container></Section>
  )
  if (state === 'error' || !data) return <div className="min-h-dvh grid place-items-center text-terracotta">Couldn’t load vendors.</div>

  const cats = data.categories || []

  return (
    <>
      <Seo title="Vendors · Organizer" noindex />
      <section className="bg-plum-deep text-cream pt-32 pb-10">
        <Container>
          <Link to="/org" className="inline-flex items-center gap-2 text-cream/70 hover:text-cream text-sm mb-5"><ArrowLeft size={16} /> Dashboard</Link>
          <h1 className="font-display text-4xl sm:text-5xl">Vendor catalog</h1>
          <p className="text-cream/70 mt-2">Add, edit, and verify marketplace vendors.</p>
        </Container>
      </section>

      <Section tone="cream" pad="md">
        <Container className="grid lg:grid-cols-3 gap-8 items-start">
          {/* List */}
          <div className="lg:col-span-2 space-y-3">
            {data.vendors.length === 0 ? <p className="text-ink/55 text-sm">No vendors yet — add one.</p> : data.vendors.map((v) => (
              <div key={v.id} className="rounded-2xl bg-cream-deep border border-plum/8 p-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-plum flex items-center gap-2">
                    {v.name}
                    {v.verified ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-kente/15 text-kente inline-flex items-center gap-1"><CheckCircle size={12} /> Verified</span> : null}
                  </p>
                  <p className="text-ink/50 text-xs capitalize">{v.category}{v.location ? ` · ${v.location}` : ''} · from {formatMoney(v.price_from, v.currency)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button disabled={busy} onClick={() => run(() => api.orgVendorAction({ action: 'verify', id: v.id, verified: !v.verified }))} className="text-xs rounded-full border border-plum/20 px-3 py-1.5 text-plum disabled:opacity-50">{v.verified ? 'Unverify' : 'Verify'}</button>
                  <button disabled={busy} onClick={() => edit(v)} className="text-xs rounded-full border border-plum/20 px-3 py-1.5 text-plum disabled:opacity-50">Edit</button>
                  <button disabled={busy} onClick={() => { if (confirm(`Delete ${v.name}?`)) run(() => api.orgVendorAction({ action: 'delete', id: v.id })) }} className="text-xs rounded-full border border-terracotta/30 px-3 py-1.5 text-terracotta disabled:opacity-50">Delete</button>
                </div>
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="rounded-3xl bg-cream-deep border border-plum/8 p-7 space-y-4 lg:sticky lg:top-28">
            <h2 className="font-display text-plum text-xl">{editId ? 'Edit vendor' : 'Add vendor'}</h2>
            <Field label="Name" required value={form.name} onChange={set('name')} placeholder="Bloom & Co. Florals" />
            <label className="block">
              <span className="block text-sm text-ink/70 mb-1.5">Category</span>
              <select value={form.category} onChange={set('category')} className="w-full rounded-xl border border-plum/15 bg-cream px-4 py-2.5 text-ink capitalize">
                {cats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <Field label="Location" value={form.location} onChange={set('location')} placeholder="Accra" />
            <Field label="Tagline" value={form.tagline} onChange={set('tagline')} placeholder="Timeless florals for timeless days" />
            <Field label="Image URL" value={form.image} onChange={set('image')} placeholder="https://…" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="From (GH₵)" type="number" value={form.price_from} onChange={set('price_from')} />
              <Field label="WhatsApp" value={form.whatsapp} onChange={set('whatsapp')} placeholder="+233…" />
            </div>
            <Field label="About" value={form.about} onChange={set('about')} placeholder="Short description" />
            <div className="flex gap-2">
              <Button disabled={!form.name || busy} onClick={save} variant="primary" size="sm">{editId ? 'Save' : <><Plus size={16} /> Add</>}</Button>
              {editId && <Button onClick={reset} variant="outline" size="sm">Cancel</Button>}
            </div>
          </div>
        </Container>
      </Section>
    </>
  )
}
```

- [ ] **Step 2: Build.** Run: `npm run build` — Expected: PASS (page imports resolve).

- [ ] **Step 3: Commit.**
```bash
git add src/pages/OrgVendors.jsx
git commit -m "OrgVendors page"
```

### Task 1.5: Route + dashboard quick-links

**Files:**
- Modify: `src/main.jsx`
- Modify: `src/pages/OrgDashboard.jsx`

- [ ] **Step 1: Add the import** near the other page imports in `src/main.jsx` (after the `OrgClient` import line):
```jsx
import OrgVendors from './pages/OrgVendors.jsx'
```

- [ ] **Step 2: Add the route** in `src/main.jsx` immediately after the `/org/clients/:id` `<Route>` block (before `<Route path="*" ...>`):
```jsx
            <Route
              path="/org/vendors"
              element={
                <ProtectedRoute>
                  <OrgVendors />
                </ProtectedRoute>
              }
            />
```

- [ ] **Step 3: Add an admin quick-links row** in `src/pages/OrgDashboard.jsx`. In the hero `<section>` block, replace the heading line:
```jsx
          <h1 className="font-display text-4xl sm:text-5xl">Welcome, {data.organizer.name?.split(' ')[0] || 'planner'}.</h1>
```
with:
```jsx
          <h1 className="font-display text-4xl sm:text-5xl">Welcome, {data.organizer.name?.split(' ')[0] || 'planner'}.</h1>
          <nav className="mt-5 flex flex-wrap gap-2">
            <Link to="/org/vendors" className="text-sm rounded-full bg-cream/10 hover:bg-cream/20 text-cream px-4 py-1.5 transition-colors">Vendors</Link>
          </nav>
```
(`Link` is already imported in OrgDashboard.jsx. The Inbox and Team links are added in Phases 2 and 3.)

- [ ] **Step 4: Build.** Run: `npm run build` — Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add src/main.jsx src/pages/OrgDashboard.jsx
git commit -m "Route + dashboard link for OrgVendors"
```

### Task 1.6: Deploy + verify Phase 1

- [ ] **Step 1: Deploy.**
```bash
npm run build
CLOUDFLARE_ACCOUNT_ID=ea2eb3a9813660dfca2a60e594858538 npx wrangler pages deploy dist --project-name=gather-ghana-events --commit-dirty=true
```
Expected: "Compiled Worker successfully" + "Deployment complete".

- [ ] **Step 2: Verify the endpoint is gated.**
```bash
curl -sS -w "\nstatus=%{http_code}\n" https://gge.ohwpstudios.org/api/org/vendors
```
Expected: `{"ok":false,"error":"Organizer access required"}` and `status=403`.

- [ ] **Step 3: Manual round-trip.** Sign in as organizer, open `https://gge.ohwpstudios.org/org/vendors`, add a vendor, verify it, edit it, delete it. Confirm it also appears/disappears on the public `/vendors` page (verified ones rank first).

- [ ] **Step 4: Push.**
```bash
git push origin main
```

---

## PHASE 2 — Message replies + status

### Task 2.1: Migration + schema column

**Files:**
- Create: `migrations/add-message-status.sql`
- Modify: `schema.sql` (the `messages` CREATE TABLE, lines ~65-71)

- [ ] **Step 1: Create `migrations/add-message-status.sql`:**
```sql
-- Adds inbox status + replied timestamp to contact messages.
-- Apply once: wrangler d1 execute gather-ghana --file=./migrations/add-message-status.sql --remote
ALTER TABLE messages ADD COLUMN status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE messages ADD COLUMN replied_at INTEGER;
```

- [ ] **Step 2: Update `schema.sql`** so fresh installs match. Replace the `messages` table block:
```sql
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
```
with:
```sql
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  body        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'new',   -- new | read | replied
  replied_at  INTEGER,
  created_at  INTEGER NOT NULL
);
```

- [ ] **Step 3: Commit (migration applied during deploy in Task 2.7).**
```bash
git add migrations/add-message-status.sql schema.sql
git commit -m "Schema: message status + replied_at"
```

### Task 2.2: `sendMessageReply` email

**Files:**
- Modify: `functions/_lib/email.js` (append a function)

- [ ] **Step 1: Append to `functions/_lib/email.js`:**
```js
const escHtml = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))

/** Organizer's reply to a contact-form message. */
export function sendMessageReply(env, { to, name, body, replyTo }) {
  const paragraphs = String(body)
    .split('\n')
    .map((line) => `<p>${escHtml(line) || '&nbsp;'}</p>`)
    .join('')
  return sendEmail(env, {
    to,
    replyTo,
    subject: 'Re: your message to Gather Ghana Events',
    html: shell(
      `Hello ${escHtml(name || 'there')},`,
      `${paragraphs}<p style="color:#6b6168;font-size:13px;margin-top:20px">— The Gather Ghana Events team</p>`
    ),
  })
}
```

- [ ] **Step 2: Build.** Run: `npm run build` — Expected: PASS.

- [ ] **Step 3: Commit.**
```bash
git add functions/_lib/email.js
git commit -m "Email: sendMessageReply"
```

### Task 2.3: Messages admin API

**Files:**
- Create: `functions/api/org/messages.js`

- [ ] **Step 1: Create `functions/api/org/messages.js`:**
```js
// /api/org/messages — organizer inbox for contact-form messages.
//   GET                   -> all messages with status
//   POST { action, ... }  -> reply | mark

import { ok, json, fail, readJson } from '../../_lib/respond.js'
import { now, clampStr } from '../../_lib/util.js'
import { currentOrganizer } from '../../_lib/auth.js'
import { sendMessageReply } from '../../_lib/email.js'

const STATUSES = ['new', 'read', 'replied']

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const { results } = await env.DB
    .prepare('SELECT id, name, email, body, status, replied_at, created_at FROM messages ORDER BY created_at DESC')
    .all()
  return json({ ok: true, messages: results })
}

export async function onRequestPost({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const db = env.DB
  const body = await readJson(request)
  const action = body.action

  if (action === 'mark') {
    const status = STATUSES.includes(body.status) ? body.status : null
    if (!status) return fail('Invalid status', 422)
    const r = await db.prepare('UPDATE messages SET status = ? WHERE id = ?').bind(status, clampStr(body.id, 60)).run()
    if (!r.meta.changes) return fail('Message not found', 404)
    return ok({ id: body.id, status })
  }

  if (action === 'reply') {
    const text = clampStr(body.body, 4000)
    if (!text) return fail('Reply body required', 422)
    const msg = await db.prepare('SELECT id, name, email FROM messages WHERE id = ?').bind(clampStr(body.id, 60)).first()
    if (!msg) return fail('Message not found', 404)
    const sent = await sendMessageReply(env, { to: msg.email, name: msg.name, body: text, replyTo: org.email })
    if (!sent.sent) return fail('Email is not configured or failed to send', 502)
    await db.prepare('UPDATE messages SET status = ?, replied_at = ? WHERE id = ?').bind('replied', now(), msg.id).run()
    return ok({ id: msg.id, status: 'replied' })
  }

  return fail('Unknown action', 422)
}
```

- [ ] **Step 2: Build.** Run: `npm run build` — Expected: PASS.

- [ ] **Step 3: Commit.**
```bash
git add functions/api/org/messages.js
git commit -m "Messages admin API: list + reply/mark"
```

### Task 2.4: Surface status in the dashboard overview

**Files:**
- Modify: `functions/api/org/overview.js` (the `msgs` query)

- [ ] **Step 1:** In `functions/api/org/overview.js`, change the messages query line:
```js
    db.prepare('SELECT name, email, body, created_at FROM messages ORDER BY created_at DESC LIMIT 10').all(),
```
to:
```js
    db.prepare('SELECT id, name, email, body, status, created_at FROM messages ORDER BY created_at DESC LIMIT 10').all(),
```

- [ ] **Step 2: Commit.**
```bash
git add functions/api/org/overview.js
git commit -m "Overview: include message status"
```

### Task 2.5: API client methods

**Files:**
- Modify: `src/lib/api.js` (after the vendor methods added in Task 1.3)

- [ ] **Step 1: Add** after the `orgVendorAction` line:
```js
  orgMessages: () => request('/org/messages'),
  orgMessageAction: (payload) => request('/org/messages', { method: 'POST', body: payload }),
```

- [ ] **Step 2: Build.** Run: `npm run build` — Expected: PASS.

- [ ] **Step 3: Commit.**
```bash
git add src/lib/api.js
git commit -m "API client: message admin methods"
```

### Task 2.6: `OrgMessages` page + route + dashboard link

**Files:**
- Create: `src/pages/OrgMessages.jsx`
- Modify: `src/main.jsx`
- Modify: `src/pages/OrgDashboard.jsx`

- [ ] **Step 1: Create `src/pages/OrgMessages.jsx`:**
```jsx
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { ArrowLeft, Spinner, Lock, Mail, CheckCircle } from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const statusChip = {
  new: 'bg-champagne/25 text-terracotta',
  read: 'bg-plum/10 text-ink/55',
  replied: 'bg-kente/15 text-kente',
}

export default function OrgMessages() {
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')
  const [openId, setOpenId] = useState(null)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try { setData(await api.orgMessages()); setState('ok') }
    catch (e) { setState(e instanceof ApiError && (e.status === 403 || e.status === 401) ? 'forbidden' : 'error') }
  }, [])
  useEffect(() => { load() }, [load])

  const openMessage = async (m) => {
    setOpenId(m.id); setReply(''); setErr('')
    if (m.status === 'new') { try { await api.orgMessageAction({ action: 'mark', id: m.id, status: 'read' }); await load() } catch { /* noop */ } }
  }
  const sendReply = async (m) => {
    setBusy(true); setErr('')
    try {
      await api.orgMessageAction({ action: 'reply', id: m.id, body: reply })
      setOpenId(null); setReply(''); await load()
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not send the reply.') }
    finally { setBusy(false) }
  }

  if (state === 'loading') return <div className="min-h-dvh grid place-items-center text-plum"><Spinner size={32} /></div>
  if (state === 'forbidden') return (
    <Section tone="cream" className="min-h-dvh grid place-items-center"><Container className="text-center max-w-md">
      <Lock size={36} className="text-terracotta mx-auto" />
      <h1 className="font-display text-plum text-3xl mt-4">Organizer access only</h1>
      <Button to="/login" variant="primary" size="md" className="mt-6">Sign in</Button>
    </Container></Section>
  )
  if (state === 'error' || !data) return <div className="min-h-dvh grid place-items-center text-terracotta">Couldn’t load messages.</div>

  return (
    <>
      <Seo title="Inbox · Organizer" noindex />
      <section className="bg-plum-deep text-cream pt-32 pb-10">
        <Container>
          <Link to="/org" className="inline-flex items-center gap-2 text-cream/70 hover:text-cream text-sm mb-5"><ArrowLeft size={16} /> Dashboard</Link>
          <h1 className="font-display text-4xl sm:text-5xl">Inbox</h1>
          <p className="text-cream/70 mt-2">Contact-form messages. Replies are emailed to the sender.</p>
        </Container>
      </section>

      <Section tone="cream" pad="md">
        <Container className="max-w-3xl space-y-3">
          {data.messages.length === 0 ? <p className="text-ink/55 text-sm">No messages.</p> : data.messages.map((m) => (
            <div key={m.id} className="rounded-2xl bg-cream-deep border border-plum/8 p-5">
              <button onClick={() => (openId === m.id ? setOpenId(null) : openMessage(m))} className="w-full text-left flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-plum">{m.name} <span className="text-ink/45 text-sm font-sans">· {m.email}</span></p>
                  <p className="text-ink/55 text-xs">{fmtDate(m.created_at)}</p>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${statusChip[m.status] || statusChip.read}`}>{m.status}</span>
              </button>
              {openId === m.id && (
                <div className="mt-4 pt-4 border-t border-plum/10">
                  <p className="text-ink/75 text-sm whitespace-pre-line leading-relaxed">{m.body}</p>
                  <div className="mt-4">
                    <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} placeholder={`Reply to ${m.name}…`}
                      className="w-full rounded-xl border border-plum/15 bg-cream px-4 py-3 text-ink text-sm" />
                    {err && <p role="alert" className="text-terracotta text-sm mt-2">{err}</p>}
                    <div className="mt-3 flex items-center gap-3">
                      <Button onClick={() => sendReply(m)} disabled={!reply.trim() || busy} variant="primary" size="sm"><Mail size={16} /> {busy ? 'Sending…' : 'Send reply'}</Button>
                      {m.status === 'replied' && <span className="text-kente text-xs inline-flex items-center gap-1"><CheckCircle size={13} /> Replied {fmtDate(m.replied_at)}</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </Container>
      </Section>
    </>
  )
}
```

- [ ] **Step 2: Add import + route in `src/main.jsx`.** Import after `OrgVendors`:
```jsx
import OrgMessages from './pages/OrgMessages.jsx'
```
Route after the `/org/vendors` block:
```jsx
            <Route
              path="/org/messages"
              element={
                <ProtectedRoute>
                  <OrgMessages />
                </ProtectedRoute>
              }
            />
```

- [ ] **Step 3: Add the Inbox link** to the dashboard quick-links nav in `src/pages/OrgDashboard.jsx` (the `<nav>` added in Task 1.5) — add after the Vendors link:
```jsx
            <Link to="/org/messages" className="text-sm rounded-full bg-cream/10 hover:bg-cream/20 text-cream px-4 py-1.5 transition-colors">Inbox</Link>
```

- [ ] **Step 4: Build.** Run: `npm run build` — Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add src/pages/OrgMessages.jsx src/main.jsx src/pages/OrgDashboard.jsx
git commit -m "OrgMessages inbox page + route + dashboard link"
```

### Task 2.7: Migrate + deploy + verify Phase 2

- [ ] **Step 1: Apply the migration to live D1.**
```bash
CLOUDFLARE_ACCOUNT_ID=ea2eb3a9813660dfca2a60e594858538 npx wrangler d1 execute gather-ghana --file=./migrations/add-message-status.sql --remote
```
Expected: success, `changed_db: true`. (Run exactly once — `ADD COLUMN` errors if rerun.)

- [ ] **Step 2: Deploy.**
```bash
npm run build
CLOUDFLARE_ACCOUNT_ID=ea2eb3a9813660dfca2a60e594858538 npx wrangler pages deploy dist --project-name=gather-ghana-events --commit-dirty=true
```

- [ ] **Step 3: Verify gating.**
```bash
curl -sS -w "\nstatus=%{http_code}\n" https://gge.ohwpstudios.org/api/org/messages
```
Expected: `403` `Organizer access required`.

- [ ] **Step 4: Manual round-trip.** Submit the public `/contact` form, open `/org/messages`, confirm the message shows `new`, open it (→ `read`), reply, confirm the reply email arrives at the sender address and status flips to `replied`.

- [ ] **Step 5: Push.**
```bash
git push origin main
```

---

## PHASE 3 — Organizer / account management

### Task 3.1: Migration + schema column

**Files:**
- Create: `migrations/add-client-organizer.sql`
- Modify: `schema.sql` (the `clients` CREATE TABLE)

- [ ] **Step 1: Create `migrations/add-client-organizer.sql`:**
```sql
-- DB-backed organizer role (config ORGANIZER_EMAILS remains a bootstrap fallback).
-- Apply once: wrangler d1 execute gather-ghana --file=./migrations/add-client-organizer.sql --remote
ALTER TABLE clients ADD COLUMN is_organizer INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Update `schema.sql`** `clients` table — add the column before `created_at`:
```sql
CREATE TABLE IF NOT EXISTS clients (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  phone        TEXT,
  is_organizer INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);
```

- [ ] **Step 3: Commit.**
```bash
git add migrations/add-client-organizer.sql schema.sql
git commit -m "Schema: clients.is_organizer"
```

### Task 3.2: Magic-link helper + organizer-resolution helper + tests

**Files:**
- Modify: `functions/_lib/auth.js`
- Modify: `functions/api/auth/request.js`
- Modify: `scripts/test-money.mjs`

- [ ] **Step 1: Write the failing test.** Add to `scripts/test-money.mjs` imports:
```js
import { isOrganizer } from '../functions/_lib/auth.js'
```
Add a section before the final summary line:
```js
console.log('organizer')
const oenv = { ORGANIZER_EMAILS: 'boss@x.com' }
t('config email', () => assert.equal(isOrganizer(oenv, { email: 'boss@x.com', is_organizer: 0 }), true))
t('db flag', () => assert.equal(isOrganizer(oenv, { email: 'other@x.com', is_organizer: 1 }), true))
t('neither', () => assert.equal(isOrganizer(oenv, { email: 'other@x.com', is_organizer: 0 }), false))
t('null client', () => assert.equal(isOrganizer(oenv, null), false))
```

- [ ] **Step 2: Run to verify it fails.** Run: `node scripts/test-money.mjs` — Expected: import error (`isOrganizer` not exported).

- [ ] **Step 3: Update `functions/_lib/auth.js`.** Change the import line at the top:
```js
import { b64urlEncode, b64urlDecode, hmacHex, safeEqual, now } from './util.js'
```
to:
```js
import { b64urlEncode, b64urlDecode, hmacHex, safeEqual, now, uid, sha256Hex } from './util.js'
```
Add `isOrganizer` after the existing `isOrganizerEmail` function:
```js
/** True if this client is an organizer — config bootstrap OR the DB role. */
export function isOrganizer(env, client) {
  if (!client) return false
  return isOrganizerEmail(env, client.email) || client.is_organizer === 1
}

/** Mint a single-use magic link for a client; stores only the token hash. */
export async function issueMagicLink(env, client, site) {
  const token = uid('') + uid('')
  const tokenHash = await sha256Hex(token)
  await env.DB
    .prepare('INSERT INTO auth_tokens (token_hash, client_id, expires_at, used, created_at) VALUES (?, ?, ?, 0, ?)')
    .bind(tokenHash, client.id, magicTokenTtl(), now())
    .run()
  return `${site}/login?token=${token}`
}
```
Replace the body of `currentOrganizer` so it selects `is_organizer` and uses `isOrganizer`:
```js
export async function currentOrganizer(request, env) {
  const clientId = await currentClientId(request, env)
  if (!clientId) return null
  const client = await env.DB.prepare('SELECT id, email, name, is_organizer FROM clients WHERE id = ?').bind(clientId).first()
  if (!client || !isOrganizer(env, client)) return null
  return client
}
```

- [ ] **Step 4: Run to verify the tests pass.** Run: `node scripts/test-money.mjs` — Expected: all pass incl. the 4 `organizer` lines.

- [ ] **Step 5: Refactor `functions/api/auth/request.js`** to use the helper. Replace the block from `// Mint a random token; store only its hash.` through the `const link = ...` line with:
```js
  const site = env.SITE_URL || new URL(request.url).origin
  const link = await issueMagicLink(env, client, site)
```
And change its import line:
```js
import { magicTokenTtl } from '../../_lib/auth.js'
```
to:
```js
import { issueMagicLink } from '../../_lib/auth.js'
```
Remove now-unused imports `uid, now, sha256Hex` from its `util.js` import (keep `isEmail, clampStr`):
```js
import { isEmail, clampStr } from '../../_lib/util.js'
```

- [ ] **Step 6: Build + test.** Run: `npm run build && node scripts/test-money.mjs` — Expected: both PASS. Manually confirm `request.js` still references `emailConfigured`/`sendMagicLink` imports it already had.

- [ ] **Step 7: Commit.**
```bash
git add functions/_lib/auth.js functions/api/auth/request.js scripts/test-money.mjs
git commit -m "Auth: isOrganizer (config OR db) + issueMagicLink helper + tests"
```

### Task 3.3: Thread the DB flag through session + verify

**Files:**
- Modify: `functions/api/auth/session.js`
- Modify: `functions/api/auth/verify.js`

- [ ] **Step 1: `functions/api/auth/session.js`** — change import and the two lines that use it. Import:
```js
import { currentClientId, isOrganizer } from '../../_lib/auth.js'
```
Select (add `is_organizer`):
```js
    .prepare('SELECT id, email, name, is_organizer FROM clients WHERE id = ?')
```
Return:
```js
  return json({ ok: true, client: { id: client.id, email: client.email, name: client.name, isOrganizer: isOrganizer(env, client) } })
```

- [ ] **Step 2: `functions/api/auth/verify.js`** — import `isOrganizer`, select `is_organizer`, use it. Import:
```js
import { createSession, sessionCookie, isOrganizer } from '../../_lib/auth.js'
```
Select:
```js
    .prepare('SELECT id, email, name, is_organizer FROM clients WHERE id = ?')
```
Return client object:
```js
    { ok: true, client: { id: client.id, email: client.email, name: client.name, isOrganizer: isOrganizer(env, client) } },
```

- [ ] **Step 3: Build.** Run: `npm run build` — Expected: PASS.

- [ ] **Step 4: Commit.**
```bash
git add functions/api/auth/session.js functions/api/auth/verify.js
git commit -m "Auth: organizer flag uses config OR db role"
```

### Task 3.4: Organizers admin API

**Files:**
- Create: `functions/api/org/organizers.js`

- [ ] **Step 1: Create `functions/api/org/organizers.js`:**
```js
// /api/org/organizers — manage who has organizer access.
//   GET                   -> { configEmails, members }
//   POST { action, ... }  -> grant | revoke | invite
// Config ORGANIZER_EMAILS are permanent (cannot be revoked from the UI).

import { ok, json, fail, readJson } from '../../_lib/respond.js'
import { uid, now, clampStr, isEmail } from '../../_lib/util.js'
import { currentOrganizer, isOrganizerEmail, issueMagicLink } from '../../_lib/auth.js'
import { sendMagicLink } from '../../_lib/email.js'

const configList = (env) =>
  (env.ORGANIZER_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean)

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const { results } = await env.DB
    .prepare('SELECT id, email, name, is_organizer FROM clients WHERE is_organizer = 1 ORDER BY name')
    .all()
  const members = results.map((c) => ({
    clientId: c.id, email: c.email, name: c.name,
    source: isOrganizerEmail(env, c.email) ? 'config' : 'db',
    isSelf: c.id === org.id,
  }))
  return json({ ok: true, configEmails: configList(env), members })
}

export async function onRequestPost({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const db = env.DB
  const body = await readJson(request)
  const action = body.action

  if (action === 'grant') {
    const email = clampStr(body.email, 160).toLowerCase()
    const client = body.clientId
      ? await db.prepare('SELECT id FROM clients WHERE id = ?').bind(clampStr(body.clientId, 60)).first()
      : await db.prepare('SELECT id FROM clients WHERE email = ?').bind(email).first()
    if (!client) return fail('No client with that email — use Invite instead', 404)
    await db.prepare('UPDATE clients SET is_organizer = 1 WHERE id = ?').bind(client.id).run()
    return ok({ clientId: client.id })
  }

  if (action === 'revoke') {
    const id = clampStr(body.clientId, 60)
    const client = await db.prepare('SELECT id, email FROM clients WHERE id = ?').bind(id).first()
    if (!client) return fail('Client not found', 404)
    if (client.id === org.id) return fail('You cannot revoke your own access', 409)
    if (isOrganizerEmail(env, client.email)) return fail('This organizer is set in config and cannot be revoked here', 409)
    await db.prepare('UPDATE clients SET is_organizer = 0 WHERE id = ?').bind(id).run()
    return ok({ clientId: id, revoked: true })
  }

  if (action === 'invite') {
    const email = clampStr(body.email, 160).toLowerCase()
    if (!isEmail(email)) return fail('Enter a valid email address', 422)
    const name = clampStr(body.name, 120) || email.split('@')[0]
    let client = await db.prepare('SELECT id FROM clients WHERE email = ?').bind(email).first()
    if (client) {
      await db.prepare('UPDATE clients SET is_organizer = 1 WHERE id = ?').bind(client.id).run()
    } else {
      const id = uid('cl_')
      await db.prepare('INSERT INTO clients (id, email, name, is_organizer, created_at) VALUES (?,?,?,1,?)')
        .bind(id, email, name, now()).run()
      client = { id }
    }
    const site = env.SITE_URL || new URL(request.url).origin
    const link = await issueMagicLink(env, { id: client.id }, site)
    const sent = await sendMagicLink(env, { to: email, link, name })
    return ok({ clientId: client.id, invited: true, emailed: sent.sent })
  }

  return fail('Unknown action', 422)
}
```

- [ ] **Step 2: Build.** Run: `npm run build` — Expected: PASS.

- [ ] **Step 3: Commit.**
```bash
git add functions/api/org/organizers.js
git commit -m "Organizers admin API: grant/revoke/invite"
```

### Task 3.5: API client methods

**Files:**
- Modify: `src/lib/api.js`

- [ ] **Step 1: Add** after the `orgMessageAction` line:
```js
  orgOrganizers: () => request('/org/organizers'),
  orgOrganizerAction: (payload) => request('/org/organizers', { method: 'POST', body: payload }),
```

- [ ] **Step 2: Build.** Run: `npm run build` — Expected: PASS.

- [ ] **Step 3: Commit.**
```bash
git add src/lib/api.js
git commit -m "API client: organizer admin methods"
```

### Task 3.6: `OrgTeam` page + route + dashboard link

**Files:**
- Create: `src/pages/OrgTeam.jsx`
- Modify: `src/main.jsx`
- Modify: `src/pages/OrgDashboard.jsx`

- [ ] **Step 1: Create `src/pages/OrgTeam.jsx`:**
```jsx
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import Field from '../components/ui/Field.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { ArrowLeft, Spinner, Lock, Plus } from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'

export default function OrgTeam() {
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')
  const [invite, setInvite] = useState({ email: '', name: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try { setData(await api.orgOrganizers()); setState('ok') }
    catch (e) { setState(e instanceof ApiError && (e.status === 403 || e.status === 401) ? 'forbidden' : 'error') }
  }, [])
  useEffect(() => { load() }, [load])

  const run = async (fn) => { setBusy(true); setErr(''); setMsg('') ; try { await fn() } catch (e) { setErr(e instanceof ApiError ? e.message : 'Action failed.') } finally { setBusy(false); await load() } }
  const sendInvite = () => run(async () => {
    const res = await api.orgOrganizerAction({ action: 'invite', email: invite.email, name: invite.name })
    setMsg(res.emailed ? 'Invite sent — they’ll get a sign-in link.' : 'Added, but the invite email could not be sent.')
    setInvite({ email: '', name: '' })
  })
  const revoke = (m) => { if (confirm(`Revoke organizer access for ${m.email}?`)) run(() => api.orgOrganizerAction({ action: 'revoke', clientId: m.clientId })) }

  if (state === 'loading') return <div className="min-h-dvh grid place-items-center text-plum"><Spinner size={32} /></div>
  if (state === 'forbidden') return (
    <Section tone="cream" className="min-h-dvh grid place-items-center"><Container className="text-center max-w-md">
      <Lock size={36} className="text-terracotta mx-auto" />
      <h1 className="font-display text-plum text-3xl mt-4">Organizer access only</h1>
      <Button to="/login" variant="primary" size="md" className="mt-6">Sign in</Button>
    </Container></Section>
  )
  if (state === 'error' || !data) return <div className="min-h-dvh grid place-items-center text-terracotta">Couldn’t load the team.</div>

  return (
    <>
      <Seo title="Team · Organizer" noindex />
      <section className="bg-plum-deep text-cream pt-32 pb-10">
        <Container>
          <Link to="/org" className="inline-flex items-center gap-2 text-cream/70 hover:text-cream text-sm mb-5"><ArrowLeft size={16} /> Dashboard</Link>
          <h1 className="font-display text-4xl sm:text-5xl">Team</h1>
          <p className="text-cream/70 mt-2">Who can access the organizer portal.</p>
        </Container>
      </section>

      <Section tone="cream" pad="md">
        <Container className="grid lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-3">
            {data.members.map((m) => (
              <div key={m.clientId} className="rounded-2xl bg-cream-deep border border-plum/8 p-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-plum">{m.name} {m.isSelf && <span className="text-ink/45 text-xs">(you)</span>}</p>
                  <p className="text-ink/50 text-xs">{m.email}</p>
                </div>
                {m.source === 'config' ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-plum/10 text-ink/55">Permanent (config)</span>
                ) : m.isSelf ? null : (
                  <button disabled={busy} onClick={() => revoke(m)} className="text-xs rounded-full border border-terracotta/30 px-3 py-1.5 text-terracotta disabled:opacity-50">Revoke</button>
                )}
              </div>
            ))}
            {data.configEmails.filter((e) => !data.members.some((m) => m.email === e)).map((e) => (
              <div key={e} className="rounded-2xl bg-cream-deep border border-plum/8 p-5 flex items-center justify-between gap-3">
                <p className="text-ink/70 text-sm">{e} <span className="text-ink/40 text-xs">(not yet signed in)</span></p>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-plum/10 text-ink/55">Permanent (config)</span>
              </div>
            ))}
          </div>

          <div className="rounded-3xl bg-cream-deep border border-plum/8 p-7 space-y-4 lg:sticky lg:top-28">
            <h2 className="font-display text-plum text-xl">Invite an organizer</h2>
            <Field label="Email" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="name@example.com" />
            <Field label="Name (optional)" value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
            <Button onClick={sendInvite} disabled={!invite.email || busy} variant="primary" size="sm"><Plus size={16} /> Send invite</Button>
            {msg && <p className="text-kente text-sm">{msg}</p>}
            {err && <p role="alert" className="text-terracotta text-sm">{err}</p>}
          </div>
        </Container>
      </Section>
    </>
  )
}
```

- [ ] **Step 2: Add import + route in `src/main.jsx`.** Import after `OrgMessages`:
```jsx
import OrgTeam from './pages/OrgTeam.jsx'
```
Route after the `/org/messages` block:
```jsx
            <Route
              path="/org/team"
              element={
                <ProtectedRoute>
                  <OrgTeam />
                </ProtectedRoute>
              }
            />
```

- [ ] **Step 3: Add the Team link** to the dashboard quick-links nav in `src/pages/OrgDashboard.jsx` — after the Inbox link:
```jsx
            <Link to="/org/team" className="text-sm rounded-full bg-cream/10 hover:bg-cream/20 text-cream px-4 py-1.5 transition-colors">Team</Link>
```

- [ ] **Step 4: Build.** Run: `npm run build` — Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add src/pages/OrgTeam.jsx src/main.jsx src/pages/OrgDashboard.jsx
git commit -m "OrgTeam page + route + dashboard link"
```

### Task 3.7: Migrate + deploy + verify Phase 3

- [ ] **Step 1: Apply the migration to live D1 (once).**
```bash
CLOUDFLARE_ACCOUNT_ID=ea2eb3a9813660dfca2a60e594858538 npx wrangler d1 execute gather-ghana --file=./migrations/add-client-organizer.sql --remote
```
Expected: success, `changed_db: true`.

- [ ] **Step 2: Deploy.**
```bash
npm run build
CLOUDFLARE_ACCOUNT_ID=ea2eb3a9813660dfca2a60e594858538 npx wrangler pages deploy dist --project-name=gather-ghana-events --commit-dirty=true
```

- [ ] **Step 3: Verify gating + that existing org access still works.**
```bash
curl -sS -w "\nstatus=%{http_code}\n" https://gge.ohwpstudios.org/api/org/organizers
```
Expected: `403`. Then sign in (ohwpstudios@gmail.com, a config organizer) and confirm `/org` still loads — proving the config bootstrap path survives the auth change.

- [ ] **Step 4: Manual round-trip.** Open `/org/team`; confirm `ohwpstudios@gmail.com` shows as **Permanent (config)** with no Revoke control. Invite a second email, confirm it gets a sign-in link and appears as a `db` member with a Revoke control; revoke it.

- [ ] **Step 5: Push.**
```bash
git push origin main
```

---

## Self-review notes (addressed)

- **Spec coverage:** vendors CRUD+verify (Tasks 1.2–1.6), messages reply+status (2.1–2.7), organizers DB-role+config-bootstrap+invite (3.1–3.7), nav quick-links (1.5/2.6/3.6), shared conventions and migrations throughout. ✓
- **Auth bootstrap safety:** `isOrganizer` ORs config and DB; revoke guards block self + config targets (Task 3.4). ✓
- **No orphaned references:** `orgVerifyVendor` is fully replaced by `orgVendorAction` (Task 1.3) and the only caller is the new OrgVendors page. `issueMagicLink` is defined in Task 3.2 before its use in Tasks 3.2/3.4. ✓
```
