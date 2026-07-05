# Services Catalog (Admin-Editable) Implementation Plan · Phase A

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `/services` page's offerings + pricing an admin-managed catalog: a `services` table (seeded with the current 3), a public read API, an admin CRUD page, and a rewired public page.

**Architecture:** One unified `services` row drives both the descriptive section and the pricing card. Public `GET /api/services` (published) and admin `/api/org/services` (organizer GET, `currentEditor` create/update/delete). New `/org/services` admin page; `Services.jsx` fetches instead of using hardcoded arrays. A shared `parseFeatures` helper keeps the JSON `features` column safe.

**Tech Stack:** Cloudflare Pages Functions, D1 (SQLite), React + Vite SPA, Tailwind. Pure helper unit-tested via `node`; the rest by build + manual smoke test.

**Spec:** `docs/superpowers/specs/2026-07-05-services-catalog-design.md`

**Branch:** Create `feat/services-catalog` off `main` before Task 1.

---

## File Structure

- `schema.sql` — `services` table (modify); `migrations/add-services.sql` — table + seed (create).
- `functions/_lib/services.js` — `parseFeatures` (create); `scripts/test-services.mjs` — test (create).
- `functions/api/services/index.js` — public GET (create).
- `functions/api/org/services.js` — admin GET/POST (create).
- `src/lib/api.js` — `services`/`orgServices`/`orgServiceAction` (modify).
- `src/pages/OrgServices.jsx` — admin page (create); `src/main.jsx` — route (modify); `src/pages/OrgDashboard.jsx` — nav link (modify).
- `src/pages/Services.jsx` — rewire (modify); `src/lib/content.js` — drop `packages` (modify).

---

### Task 1: Schema + seed migration

**Files:**
- Modify: `schema.sql`
- Create: `migrations/add-services.sql`

- [ ] **Step 1: Add the table to `schema.sql`**

Append to the end of `schema.sql`:
```sql

-- Services catalog (admin-editable offerings shown on /services).
CREATE TABLE IF NOT EXISTS services (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  tagline     TEXT,
  description TEXT,
  image       TEXT,
  features    TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  price_from  INTEGER NOT NULL DEFAULT 0,   -- whole GH₵
  featured    INTEGER NOT NULL DEFAULT 0,
  published   INTEGER NOT NULL DEFAULT 1,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_services_published ON services(published, sort);
```

- [ ] **Step 2: Create the seed migration**

Create `migrations/add-services.sql`:
```sql
-- Services catalog + seed of the original three offerings. Idempotent (fixed ids + INSERT OR IGNORE).
-- Apply to live D1:
--   npx wrangler d1 execute gather-ghana --remote --file=./migrations/add-services.sql

CREATE TABLE IF NOT EXISTS services (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  tagline     TEXT,
  description TEXT,
  image       TEXT,
  features    TEXT NOT NULL DEFAULT '[]',
  price_from  INTEGER NOT NULL DEFAULT 0,
  featured    INTEGER NOT NULL DEFAULT 0,
  published   INTEGER NOT NULL DEFAULT 1,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_services_published ON services(published, sort);

INSERT OR IGNORE INTO services (id, name, tagline, description, image, features, price_from, featured, published, sort, created_at) VALUES
('svc_weddings', 'Weddings', 'Full planning, design & day-of coordination',
 'Full-service planning and styling for traditional rites, engagements, and white weddings alike — honouring custom and personality in equal measure. We coordinate vendors, design the aesthetic, and run the day so you and your family can be fully present.',
 'https://images.unsplash.com/photo-1661332517932-2d441bfb2994?auto=format&fit=crop&w=1000&q=80',
 '["Concept & design direction","Vendor sourcing & management","Full day-of coordination","Budget stewardship","Dedicated lead planner"]',
 35000, 1, 1, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('svc_celebrations', 'Celebrations', 'Birthdays, anniversaries & milestones',
 'Birthdays, anniversaries, outdoorings (naming ceremonies), engagements, and milestones. Intimate or grand, every celebration is styled to feel personal, warm, and unmistakably yours.',
 'https://images.unsplash.com/photo-1618999114008-fbf937170cdb?auto=format&fit=crop&w=1000&q=80',
 '["Theme & styling","Venue & décor sourcing","Entertainment booking","Guest experience design","On-the-day management"]',
 18000, 0, 1, 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
('svc_corporate', 'Corporate', 'Launches, galas & conferences',
 'Product launches, galas, conferences, and brand activations delivered with the polish your organisation expects — and measured against the outcomes that matter to you.',
 'https://images.unsplash.com/photo-1768508950719-4d76978fdf44?auto=format&fit=crop&w=1000&q=80',
 '["Brand-aligned design","Logistics & production","AV & technical direction","On-site management","Post-event reporting"]',
 25000, 0, 1, 3, CAST(strftime('%s','now') AS INTEGER) * 1000);
```

- [ ] **Step 3: Commit**

```bash
git add schema.sql migrations/add-services.sql
git commit -m "feat(schema): services table + seed migration"
```

---

### Task 2: `parseFeatures` helper (+ test)

**Files:**
- Create: `functions/_lib/services.js`
- Create: `scripts/test-services.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-services.mjs`:
```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/test-services.mjs`
Expected: FAIL — cannot find module `../functions/_lib/services.js`.

- [ ] **Step 3: Implement the helper**

Create `functions/_lib/services.js`:
```js
// Helpers for the services catalog.

/** Safely parse a services.features JSON column into an array of non-empty strings. */
export function parseFeatures(str) {
  try {
    const v = JSON.parse(str)
    if (!Array.isArray(v)) return []
    return v.map((x) => (x == null ? '' : String(x))).filter(Boolean)
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-services.mjs`
Expected: PASS — `OK: services helper assertions passed`

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/services.js scripts/test-services.mjs
git commit -m "feat(services): parseFeatures helper (tested)"
```

---

### Task 3: Public read API `functions/api/services/index.js`

**Files:**
- Create: `functions/api/services/index.js`

- [ ] **Step 1: Create the endpoint**

Create `functions/api/services/index.js`:
```js
// GET /api/services — published services for the public /services page.

import { ok } from '../../_lib/respond.js'
import { parseFeatures } from '../../_lib/services.js'

export async function onRequestGet({ env }) {
  const { results } = await env.DB
    .prepare('SELECT * FROM services WHERE published = 1 ORDER BY sort ASC, created_at ASC')
    .all()
  const services = results.map((s) => ({
    id: s.id, name: s.name, tagline: s.tagline, description: s.description,
    image: s.image, features: parseFeatures(s.features), price_from: s.price_from,
    featured: s.featured === 1,
  }))
  return ok({ services })
}
```

- [ ] **Step 2: Verify + commit**

Run: `node --check functions/api/services/index.js` (expect no output), then:
```bash
git add functions/api/services/index.js
git commit -m "feat(services): public GET /api/services"
```

---

### Task 4: Admin API `functions/api/org/services.js`

**Files:**
- Create: `functions/api/org/services.js`

- [ ] **Step 1: Create the endpoint**

Create `functions/api/org/services.js`:
```js
// /api/org/services — admin CRUD for the services catalog.
//   GET                    -> { services }  (incl. unpublished)
//   POST { action, ... }   -> create | update | delete

import { ok, fail, readJson } from '../../_lib/respond.js'
import { uid, now, clampStr } from '../../_lib/util.js'
import { currentOrganizer, currentEditor } from '../../_lib/auth.js'
import { parseFeatures } from '../../_lib/services.js'
import { logActivity } from '../../_lib/activity.js'

const normFeatures = (arr) =>
  JSON.stringify(Array.isArray(arr) ? arr.map((x) => clampStr(String(x), 120)).filter(Boolean).slice(0, 20) : [])

const readFields = (body) => ({
  name: clampStr(body.name, 120),
  tagline: clampStr(body.tagline, 200),
  description: clampStr(body.description, 4000),
  image: clampStr(body.image, 500),
  features: normFeatures(body.features),
  price_from: Math.max(0, parseInt(body.price_from) || 0),
  featured: body.featured ? 1 : 0,
  published: body.published === false ? 0 : 1,
  sort: parseInt(body.sort) || 0,
})

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const { results } = await env.DB.prepare('SELECT * FROM services ORDER BY sort ASC, created_at ASC').all()
  return ok({
    services: results.map((s) => ({ ...s, features: parseFeatures(s.features), featured: s.featured === 1, published: s.published === 1 })),
  })
}

export async function onRequestPost({ request, env }) {
  const org = await currentEditor(request, env)
  if (!org) return fail("Read-only access — this action isn't available.", 403)
  const db = env.DB
  const body = await readJson(request)
  const action = body.action

  if (action === 'create') {
    const f = readFields(body)
    if (!f.name) return fail('Name is required', 422, { fields: { name: 'Name is required' } })
    const id = uid('svc_')
    await db.prepare('INSERT INTO services (id, name, tagline, description, image, features, price_from, featured, published, sort, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id, f.name, f.tagline, f.description, f.image, f.features, f.price_from, f.featured, f.published, f.sort, now()).run()
    await logActivity(db, { actor: org.email, action: 'service.create', entityType: 'service', entityId: id, detail: `Service "${f.name}" created` })
    return ok({ id })
  }

  if (action === 'update') {
    const id = clampStr(body.id, 60)
    const existing = await db.prepare('SELECT id FROM services WHERE id = ?').bind(id).first()
    if (!existing) return fail('Service not found', 404)
    const f = readFields(body)
    if (!f.name) return fail('Name is required', 422, { fields: { name: 'Name is required' } })
    await db.prepare('UPDATE services SET name=?, tagline=?, description=?, image=?, features=?, price_from=?, featured=?, published=?, sort=? WHERE id=?')
      .bind(f.name, f.tagline, f.description, f.image, f.features, f.price_from, f.featured, f.published, f.sort, id).run()
    await logActivity(db, { actor: org.email, action: 'service.update', entityType: 'service', entityId: id, detail: `Service "${f.name}" updated` })
    return ok({ id })
  }

  if (action === 'delete') {
    const id = clampStr(body.id, 60)
    const s = await db.prepare('SELECT name FROM services WHERE id = ?').bind(id).first()
    if (!s) return fail('Service not found', 404)
    await db.prepare('DELETE FROM services WHERE id = ?').bind(id).run()
    await logActivity(db, { actor: org.email, action: 'service.delete', entityType: 'service', entityId: id, detail: `Service "${s.name}" deleted` })
    return ok({ deleted: true })
  }

  return fail('Unknown action', 422)
}
```

- [ ] **Step 2: Verify + commit**

Run: `node --check functions/api/org/services.js` (expect no output), then:
```bash
git add functions/api/org/services.js
git commit -m "feat(org): admin services CRUD endpoint"
```

---

### Task 5: API client methods

**Files:**
- Modify: `src/lib/api.js`

- [ ] **Step 1: Add the three methods**

In `src/lib/api.js`, immediately after the `orgEventAction: (payload) => request('/org/events', { method: 'POST', body: payload }),` line, add:
```js
  services: () => request('/services'),
  orgServices: () => request('/org/services'),
  orgServiceAction: (payload) => request('/org/services', { method: 'POST', body: payload }),
```

- [ ] **Step 2: Verify + commit**

Run: `node --check src/lib/api.js` (expect no output), then:
```bash
git add src/lib/api.js
git commit -m "feat(api): services + orgServices + orgServiceAction client methods"
```

---

### Task 6: Admin page `OrgServices.jsx` + route + dashboard link

**Files:**
- Create: `src/pages/OrgServices.jsx`
- Modify: `src/main.jsx`
- Modify: `src/pages/OrgDashboard.jsx`

- [ ] **Step 1: Create the admin page**

Create `src/pages/OrgServices.jsx`:
```jsx
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import Field from '../components/ui/Field.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { ArrowLeft, Spinner, Lock, Plus, Close } from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'
import { useAuth } from '../lib/AuthContext.jsx'

const BLANK = { id: null, name: '', tagline: '', description: '', image: '', features: [''], price_from: '', featured: false, published: true, sort: 0 }

export default function OrgServices() {
  const { client } = useAuth()
  const canWrite = client?.canWrite !== false
  const [services, setServices] = useState([])
  const [state, setState] = useState('loading')
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try { const r = await api.orgServices(); setServices(r.services || []); setState('ok') }
    catch (e) { setState(e instanceof ApiError && (e.status === 401 || e.status === 403) ? 'forbidden' : 'error') }
  }, [])
  useEffect(() => { load() }, [load])

  const startNew = () => { setErr(''); setEditing({ ...BLANK, sort: services.length + 1 }) }
  const startEdit = (s) => { setErr(''); setEditing({ ...s, price_from: String(s.price_from ?? ''), features: s.features?.length ? s.features : [''] }) }
  const setF = (k, v) => setEditing((e) => ({ ...e, [k]: v }))
  const setFeat = (i, v) => setEditing((e) => ({ ...e, features: e.features.map((x, j) => (j === i ? v : x)) }))
  const addFeat = () => setEditing((e) => ({ ...e, features: [...e.features, ''] }))
  const rmFeat = (i) => setEditing((e) => ({ ...e, features: e.features.filter((_, j) => j !== i) }))

  const save = async (ev) => {
    ev.preventDefault(); setBusy(true); setErr('')
    const payload = {
      action: editing.id ? 'update' : 'create', id: editing.id || undefined,
      name: editing.name, tagline: editing.tagline, description: editing.description, image: editing.image,
      features: editing.features.map((f) => f.trim()).filter(Boolean),
      price_from: parseInt(editing.price_from) || 0, featured: editing.featured, published: editing.published, sort: parseInt(editing.sort) || 0,
    }
    try { await api.orgServiceAction(payload); setEditing(null); await load() }
    catch (e2) { setErr(e2 instanceof ApiError ? e2.message : 'Could not save.') }
    finally { setBusy(false) }
  }
  const remove = async (s) => {
    if (!confirm(`Delete the service "${s.name}"?`)) return
    try { await api.orgServiceAction({ action: 'delete', id: s.id }); await load() } catch { /* noop */ }
  }

  if (state === 'loading') return <div className="min-h-dvh grid place-items-center text-plum"><Spinner size={32} /></div>
  if (state === 'forbidden') return (
    <Section tone="cream" className="min-h-dvh grid place-items-center"><Container className="text-center max-w-md">
      <Lock size={36} className="text-terracotta mx-auto" />
      <h1 className="font-display text-plum text-3xl mt-4">Organizer access only</h1>
      <Button to="/login" variant="primary" size="md" className="mt-6">Sign in</Button>
    </Container></Section>
  )
  if (state === 'error') return <div className="min-h-dvh grid place-items-center text-terracotta">Couldn&apos;t load services.</div>

  return (
    <>
      <Seo title="Services · Organizer" noindex />
      <section className="bg-plum-deep text-cream pt-32 pb-10">
        <Container>
          <Link to="/org" className="inline-flex items-center gap-2 text-cream/70 hover:text-cream text-sm mb-5"><ArrowLeft size={16} /> Dashboard</Link>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl sm:text-5xl">Services</h1>
              <p className="text-cream/70 mt-2">Manage the offerings and pricing on your public Services page.</p>
            </div>
            <Button onClick={startNew} disabled={!canWrite} variant="gold" size="sm"><Plus size={16} /> New service</Button>
          </div>
        </Container>
      </section>

      <Section tone="cream" pad="md">
        <Container className="grid lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-3">
            {services.length === 0 ? (
              <div className="rounded-3xl bg-cream-deep border border-plum/8 p-8 text-ink/55">No services yet — add your first offering.</div>
            ) : services.map((s) => (
              <div key={s.id} className="rounded-2xl bg-cream-deep border border-plum/8 p-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-plum">{s.name} <span className="text-ink/40 text-sm tnum">· from GH₵ {Number(s.price_from || 0).toLocaleString()}</span></p>
                  <p className="text-ink/50 text-xs">sort {s.sort}{s.featured ? ' · Featured' : ''}{s.published ? '' : ' · Hidden'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit(s)} disabled={!canWrite} className="text-xs rounded-full border border-plum/20 px-3 py-1.5 text-plum disabled:opacity-50">Edit</button>
                  <button onClick={() => remove(s)} disabled={!canWrite} className="text-xs rounded-full border border-terracotta/30 px-3 py-1.5 text-terracotta disabled:opacity-50">Delete</button>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:sticky lg:top-28">
            {!editing ? (
              <div className="rounded-3xl bg-cream-deep border border-plum/8 p-7 text-ink/55 text-sm">Select a service to edit, or add a new one.</div>
            ) : (
              <form onSubmit={save} className="rounded-3xl bg-cream-deep border border-plum/8 p-7 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-plum text-xl">{editing.id ? 'Edit service' : 'New service'}</h2>
                  <button type="button" onClick={() => setEditing(null)} className="text-ink/50 hover:text-plum"><Close size={18} /></button>
                </div>
                <Field label="Name" required value={editing.name} onChange={(e) => setF('name', e.target.value)} placeholder="Weddings" />
                <Field label="Tagline" value={editing.tagline} onChange={(e) => setF('tagline', e.target.value)} placeholder="Full planning, design & day-of coordination" />
                <Field as="textarea" rows="3" label="Description" value={editing.description} onChange={(e) => setF('description', e.target.value)} />
                <Field label="Image URL" value={editing.image} onChange={(e) => setF('image', e.target.value)} placeholder="https://…" />
                <div>
                  <label className="block text-sm text-ink/60 mb-2">What&apos;s included</label>
                  <div className="space-y-2">
                    {editing.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input value={f} onChange={(e) => setFeat(i, e.target.value)} className="flex-1 rounded-xl border border-plum/15 bg-cream px-3 py-2 text-plum text-sm" placeholder="Concept & design direction" />
                        <button type="button" onClick={() => rmFeat(i)} className="text-ink/40 hover:text-terracotta"><Close size={16} /></button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addFeat} className="mt-2 text-sm text-terracotta inline-flex items-center gap-1"><Plus size={14} /> Add item</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="From (GH₵)" type="number" value={editing.price_from} onChange={(e) => setF('price_from', e.target.value)} placeholder="35000" />
                  <Field label="Sort" type="number" value={editing.sort} onChange={(e) => setF('sort', e.target.value)} />
                </div>
                <div className="flex items-center gap-5 text-sm text-ink/70">
                  <label className="inline-flex items-center gap-2"><input type="checkbox" checked={editing.featured} onChange={(e) => setF('featured', e.target.checked)} /> Featured</label>
                  <label className="inline-flex items-center gap-2"><input type="checkbox" checked={editing.published} onChange={(e) => setF('published', e.target.checked)} /> Published</label>
                </div>
                {err && <p role="alert" className="text-sm text-terracotta">{err}</p>}
                <Button type="submit" variant="primary" size="sm" loading={busy} disabled={!canWrite} className="w-full">{editing.id ? 'Save changes' : 'Create service'}</Button>
              </form>
            )}
          </div>
        </Container>
      </Section>
    </>
  )
}
```

- [ ] **Step 2: Register the route**

In `src/main.jsx`, add the import near the other org page imports:
```jsx
import OrgServices from './pages/OrgServices.jsx'
```
Then add the route immediately AFTER the `/org/events` `<Route>` block (added earlier) and before `<Route path="*" …>`:
```jsx
            <Route
              path="/org/services"
              element={
                <ProtectedRoute>
                  <OrgServices />
                </ProtectedRoute>
              }
            />
```

- [ ] **Step 3: Add the dashboard quick-link**

In `src/pages/OrgDashboard.jsx`, the Events quick-link is:
```jsx
            <Link to="/org/events" className="text-sm rounded-full bg-cream/10 hover:bg-cream/20 text-cream px-4 py-1.5 transition-colors">Events</Link>
```
Immediately AFTER it, add:
```jsx
            <Link to="/org/services" className="text-sm rounded-full bg-cream/10 hover:bg-cream/20 text-cream px-4 py-1.5 transition-colors">Services</Link>
```

- [ ] **Step 4: Build + commit**

Run: `npm run build` (expect exit 0), then:
```bash
git add src/pages/OrgServices.jsx src/main.jsx src/pages/OrgDashboard.jsx
git commit -m "feat(org): /org/services admin page (CRUD) + nav link"
```

---

### Task 7: Rewire the public Services page

**Files:**
- Modify: `src/pages/Services.jsx`
- Modify: `src/lib/content.js`

- [ ] **Step 1: Replace `src/pages/Services.jsx` entirely**

Replace the whole file with:
```jsx
import { useState, useEffect } from 'react'
import Seo from '../components/Seo.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import Img from '../components/ui/Img.jsx'
import Reveal from '../components/ui/Reveal.jsx'
import { Section, Container, Eyebrow } from '../components/ui/Section.jsx'
import FAQ from '../components/sections/FAQ.jsx'
import { ArrowRight, Check, Spinner } from '../lib/icons.jsx'
import { api } from '../lib/api.js'
import { useCurrency } from '../lib/CurrencyContext.jsx'
import { img } from '../lib/images.js'

const process = [
  { n: '01', title: 'Discover', desc: 'We listen to your vision, date, and budget, then shape the brief together.' },
  { n: '02', title: 'Design', desc: 'A tailored concept, mood, and plan, presented for your review and refinement.' },
  { n: '03', title: 'Coordinate', desc: 'We source and manage every vendor and detail, keeping you informed throughout.' },
  { n: '04', title: 'Deliver', desc: 'On the day, we run everything seamlessly so you can simply enjoy the moment.' },
]

function Pricing({ services, fmtGhs, isForeign, currency }) {
  return (
    <Section tone="creamDeep">
      <Container>
        <div className="max-w-2xl mb-14">
          <Eyebrow className="text-terracotta mb-4">Investment</Eyebrow>
          <h2 className="font-display text-plum text-4xl sm:text-5xl leading-tight text-balance">
            Transparent starting points
          </h2>
          <p className="mt-5 text-ink/70 text-lg leading-relaxed">
            Every event is bespoke, so every quote is tailored. These indicative starting
            figures give you a sense of where each service begins.
          </p>
          {isForeign && (
            <p className="mt-3 text-sm text-terracotta">
              Shown in {currency} for convenience · events are billed in GH₵.
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          {services.map((p, i) => (
            <Reveal
              key={p.id}
              delay={i * 90}
              className={`relative rounded-3xl p-8 border flex flex-col ${
                p.featured
                  ? 'bg-plum text-cream border-plum shadow-lg md:-translate-y-3'
                  : 'bg-cream text-ink border-plum/10 shadow-sm'
              }`}
            >
              {p.featured && (
                <span className="absolute top-6 right-6 text-xs uppercase tracking-widest text-champagne-light">
                  Most popular
                </span>
              )}
              <h3 className={`font-display text-3xl ${p.featured ? 'text-cream' : 'text-plum'}`}>{p.name}</h3>
              <p className={`mt-2 text-sm ${p.featured ? 'text-cream/60' : 'text-ink/55'}`}>{p.tagline}</p>
              <div className="mt-6 flex items-baseline gap-2">
                <span className={`text-sm ${p.featured ? 'text-cream/60' : 'text-ink/50'}`}>from</span>
                <span className="font-display text-4xl tnum">{fmtGhs(p.price_from)}</span>
              </div>
              <ul className="mt-7 space-y-3 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <Check size={18} className={`mt-0.5 shrink-0 ${p.featured ? 'text-champagne-light' : 'text-terracotta'}`} />
                    <span className={p.featured ? 'text-cream/80' : 'text-ink/70'}>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Button to="/book" variant={p.featured ? 'gold' : 'outline'} size="md" className="w-full">
                  Get a tailored quote
                </Button>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  )
}

export default function Services() {
  const { fmtGhs, isForeign, currency } = useCurrency()
  const [services, setServices] = useState(null)

  useEffect(() => {
    let cancelled = false
    api.services()
      .then((r) => { if (!cancelled) setServices(r.services || []) })
      .catch(() => { if (!cancelled) setServices([]) })
    return () => { cancelled = true }
  }, [])

  return (
    <>
      <Seo
        title="Services & Pricing"
        description="Full-service event planning, styling, and coordination in Accra — weddings, celebrations, and corporate events, with transparent starting prices."
      />
      <PageHeader
        eyebrow="Services"
        title={<>How we bring your <span className="italic text-champagne-light">vision</span> to life</>}
        subtitle="Full-service planning, styling, and coordination, tailored to the scale and spirit of your event."
        image={img.corporate.src}
      />

      <Section tone="cream">
        <Container className="space-y-10">
          {services === null ? (
            <div className="grid place-items-center py-16 text-plum"><Spinner size={28} /></div>
          ) : services.map((s, i) => (
            <Reveal key={s.id} className="grid md:grid-cols-12 gap-8 lg:gap-10 items-center">
              <div className={`md:col-span-5 ${i % 2 ? 'md:order-2' : ''}`}>
                <Img src={s.image} alt={s.name} fallback="from-terracotta/30 to-plum/40" ratio="3 / 2" className="rounded-3xl shadow-md" />
              </div>
              <div className="md:col-span-7">
                <span className="font-display italic text-champagne text-2xl">0{i + 1}</span>
                <h2 className="font-display text-plum text-4xl mt-2 mb-4">{s.name}</h2>
                <p className="text-ink/70 leading-relaxed max-w-prose">{s.description}</p>
                <ul className="mt-6 grid sm:grid-cols-2 gap-x-8 gap-y-3">
                  {s.features.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-ink/70">
                      <Check size={17} className="text-terracotta shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </Container>
      </Section>

      {services && services.length > 0 && (
        <Pricing services={services} fmtGhs={fmtGhs} isForeign={isForeign} currency={currency} />
      )}

      <Section tone="plum">
        <Container>
          <h2 className="font-display text-4xl sm:text-5xl mb-16">
            The <span className="italic text-champagne-light">process</span>
          </h2>
          <div className="grid md:grid-cols-4 gap-10">
            {process.map((p, i) => (
              <Reveal key={p.n} delay={i * 80}>
                <div className="font-display italic text-champagne text-3xl mb-4">{p.n}</div>
                <h3 className="font-display text-2xl mb-3">{p.title}</h3>
                <p className="text-cream/60 leading-relaxed text-sm">{p.desc}</p>
              </Reveal>
            ))}
          </div>
          <div className="mt-20 text-center">
            <Button to="/book" variant="gold" size="lg">
              Begin with a conversation <ArrowRight size={18} />
            </Button>
          </div>
        </Container>
      </Section>

      <FAQ />
    </>
  )
}
```

- [ ] **Step 2: Remove the now-unused `packages` export**

In `src/lib/content.js`, delete the entire `export const packages = [ … ]` block (the array of three pricing packages, plus its `// Indicative starting prices…` comment line). Leave `testimonials`, `faqs`, and `fmtGhs` intact.

- [ ] **Step 3: Verify + build + commit**

Run: `grep -rn "packages" src/` — expect only the incidental word inside a FAQ answer string in `content.js` (no `import { packages }` and no `export const packages`).
Run: `npm run build` (expect exit 0), then:
```bash
git add src/pages/Services.jsx src/lib/content.js
git commit -m "feat(services): rewire public Services page to the catalog API"
```

---

### Task 8: Migrate live D1, deploy, verify

**Files:** none (operational). Requires the correct wrangler login (**ghwmelite@gmail.com / acct ea2eb3a9…**).

- [ ] **Step 1: Tests + build**

Run: `node scripts/test-services.mjs && npm run build`
Expected: `OK: services helper assertions passed` then a clean build.

- [ ] **Step 2: Migrate the live D1 (creates table + seeds 3 services)**

Run:
```bash
npx wrangler d1 execute gather-ghana --remote --yes --file=./migrations/add-services.sql
```
Expected: success. (Re-runnable — `IF NOT EXISTS` + `INSERT OR IGNORE`.)

- [ ] **Step 3: Deploy to production**

Run: `npx wrangler pages deploy dist --project-name gather-ghana-events --branch main`
Expected: "Deployment complete".

- [ ] **Step 4: Manual verification on production**

1. `GET https://gge.ohwpstudios.org/api/services` returns the 3 seeded services (features as arrays).
2. `/services` renders the three offerings + pricing exactly as before — now DB-driven.
3. `/org/services` (organizer): **New service** → publish → appears on `/services` in both sections;
   toggle Published off → disappears; edit price/features → reflected; delete → gone.
4. As a **viewer** (read-only): `/org/services` lists services but New/Edit/Delete are disabled; a
   direct `POST /api/org/services` returns 403.
5. Dashboard quick-links show **Services** → `/org/services`.

- [ ] **Step 5: Finish the branch**

Use `superpowers:finishing-a-development-branch` to merge `feat/services-catalog` to `main` (and push).

---

## Self-Review Notes

- **Spec coverage:** table + seed → Task 1; `parseFeatures` (+test) → Task 2; public GET → Task 3;
  admin GET/POST create/update/delete (currentEditor) → Task 4; api client → Task 5; OrgServices page
  + route + nav → Task 6; public rewire + `content.js` cleanup → Task 7; live migration + deploy → Task 8.
  All covered.
- **Name consistency:** `parseFeatures` defined in Task 2, used in Tasks 3 & 4; response field
  `price_from` (whole GH₵) produced by Tasks 3/4 and consumed by `Services.jsx`/`OrgServices.jsx`
  (Tasks 6/7); `features` is an array in every consumer; action strings `create|update|delete` match
  between endpoint (Task 4) and page (Task 6). `img` import retained in Services.jsx for the
  PageHeader image only.
- **Build stays green:** api methods (Task 5) precede the page using them (Task 6); the `/org/services`
  route (Task 6) precedes nothing that depends on it earlier; `packages` removed from `content.js`
  only after `Services.jsx` stops importing it (both in Task 7); the grep guard confirms no stray
  import.
- **Viewer role respected:** create/update/delete via `currentEditor` (403), and every mutating
  control is `disabled={!canWrite}`.
- **Money units:** `price_from` is whole GH₵ (matches the old `from` values + `fmtGhs`), documented in
  the schema comment and the spec.
