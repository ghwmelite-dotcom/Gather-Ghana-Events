# Editable Page Content (Process · FAQ · Testimonials) Implementation Plan · Phase B

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Process steps, FAQ, and testimonials admin-editable via one generic `site_content` table, a public read API, an admin page, and rewired public components.

**Architecture:** A single `site_content` table (`type`, JSON `data`, `sort`, `published`) seeded with the current content. Public `GET /api/content` returns published items grouped by type; admin `/api/org/content` does CRUD via `currentEditor`. A new `/org/content` admin page; `FAQ.jsx`/`Testimonials.jsx`/`Services.jsx` fetch instead of importing hardcoded arrays. A shared `functions/_lib/site-content.js` parses/groups.

**Tech Stack:** Cloudflare Pages Functions, D1, React + Vite SPA, Tailwind. Pure helper unit-tested via `node`; rest by build + manual smoke test.

**Spec:** `docs/superpowers/specs/2026-07-05-site-content-editable-design.md`

**Branch:** Create `feat/site-content` off `main` before Task 1.

---

## File Structure

- `schema.sql` (modify) + `migrations/add-site-content.sql` (create) — table + seed.
- `functions/_lib/site-content.js` (create) + `scripts/test-site-content.mjs` (create) — helper + test.
- `functions/api/content/index.js` (create) — public GET.
- `functions/api/org/content.js` (create) — admin CRUD.
- `src/lib/api.js` (modify) — `content`/`orgContent`/`orgContentAction`.
- `src/pages/OrgContent.jsx` (create), `src/main.jsx` (modify), `src/pages/OrgDashboard.jsx` (modify) — admin page + route + nav.
- `src/components/sections/FAQ.jsx`, `src/components/sections/Testimonials.jsx`, `src/pages/Services.jsx`, `src/lib/content.js` (modify) — rewire.

---

### Task 1: Schema + seed migration

**Files:**
- Modify: `schema.sql`
- Create: `migrations/add-site-content.sql`

- [ ] **Step 1: Add the table to `schema.sql`**

Append to the end of `schema.sql`:
```sql

-- Editable page content: process steps, FAQ, testimonials (admin-managed).
CREATE TABLE IF NOT EXISTS site_content (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,               -- process | faq | testimonial
  data       TEXT NOT NULL DEFAULT '{}',   -- JSON object, shape per type
  sort       INTEGER NOT NULL DEFAULT 0,
  published  INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_site_content ON site_content(type, published, sort);
```

- [ ] **Step 2: Create the seed migration**

Create `migrations/add-site-content.sql`:
```sql
-- site_content table + seed of current Process/FAQ/testimonials. Idempotent (fixed ids + INSERT OR IGNORE).
-- Apply to live D1:
--   npx wrangler d1 execute gather-ghana --remote --file=./migrations/add-site-content.sql

CREATE TABLE IF NOT EXISTS site_content (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,
  data       TEXT NOT NULL DEFAULT '{}',
  sort       INTEGER NOT NULL DEFAULT 0,
  published  INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_site_content ON site_content(type, published, sort);

INSERT OR IGNORE INTO site_content (id, type, data, sort, published, created_at) VALUES
('sc_process_1', 'process', '{"title":"Discover","desc":"We listen to your vision, date, and budget, then shape the brief together."}', 1, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('sc_process_2', 'process', '{"title":"Design","desc":"A tailored concept, mood, and plan, presented for your review and refinement."}', 2, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('sc_process_3', 'process', '{"title":"Coordinate","desc":"We source and manage every vendor and detail, keeping you informed throughout."}', 3, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('sc_process_4', 'process', '{"title":"Deliver","desc":"On the day, we run everything seamlessly so you can simply enjoy the moment."}', 4, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('sc_faq_1', 'faq', '{"q":"How far in advance should we book?","a":"For weddings and large events we recommend 6–12 months. For intimate celebrations, 2–3 months is often enough. That said, we occasionally take on shorter timelines — reach out and we will tell you honestly what is possible."}', 1, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('sc_faq_2', 'faq', '{"q":"Do you work within a set budget?","a":"Always. We design around your budget rather than against it, and we steward it carefully throughout — sourcing vendors, tracking spend, and flagging trade-offs early so there are no surprises."}', 2, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('sc_faq_3', 'faq', '{"q":"What areas do you serve?","a":"We are based in Accra and work across Ghana. For destination events elsewhere, travel and accommodation are quoted separately."}', 3, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('sc_faq_4', 'faq', '{"q":"How do payments and deposits work?","a":"A 30% deposit secures your date. Payments are processed securely via Paystack — Mobile Money (MTN, Vodafone, AirtelTigo) and card. The balance is split across agreed milestones, all visible in your client portal."}', 4, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('sc_faq_5', 'faq', '{"q":"Can we just hire you for day-of coordination?","a":"Yes. While many clients choose full planning and styling, we also offer styling-only and day-of coordination packages. Tell us where you are and we will shape the right scope."}', 5, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('sc_testimonial_1', 'testimonial', '{"quote":"They carried every detail so we could simply be present. Our guests still talk about how seamless and beautiful the day felt.","name":"Ama & Kojo","event":"Garden Wedding, Aburi"}', 1, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('sc_testimonial_2', 'testimonial', '{"quote":"Calm, organised, and genuinely creative. Gather turned a corporate launch into something our whole company felt proud of.","name":"Selorm Tetteh","event":"Brand Launch, Accra"}', 2, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('sc_testimonial_3', 'testimonial', '{"quote":"From the first conversation it felt personal. They listened, then designed a celebration that was unmistakably ours.","name":"The Mensah Family","event":"50th Anniversary"}', 3, 1, CAST(strftime('%s','now') AS INTEGER) * 1000);
```

- [ ] **Step 3: Commit**

```bash
git add schema.sql migrations/add-site-content.sql
git commit -m "feat(schema): site_content table + seed migration"
```

---

### Task 2: `site-content.js` helper (+ test)

**Files:**
- Create: `functions/_lib/site-content.js`
- Create: `scripts/test-site-content.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-site-content.mjs`:
```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/test-site-content.mjs`
Expected: FAIL — cannot find module `../functions/_lib/site-content.js`.

- [ ] **Step 3: Implement the helper**

Create `functions/_lib/site-content.js`:
```js
// Helpers for editable site content (process, FAQ, testimonials).

export const CONTENT_TYPES = ['process', 'faq', 'testimonial']

/** Parse a site_content.data JSON column into a plain object (or {} on bad input). */
export function parseData(str) {
  try {
    const v = JSON.parse(str)
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch {
    return {}
  }
}

/** Group ordered rows into { process, faq, testimonial } with data merged in. */
export function groupContent(rows) {
  const out = { process: [], faq: [], testimonial: [] }
  for (const r of rows) {
    if (!CONTENT_TYPES.includes(r.type)) continue
    out[r.type].push({ id: r.id, ...parseData(r.data), sort: r.sort, published: r.published === 1 })
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-site-content.mjs`
Expected: PASS — `OK: site-content helper assertions passed`

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/site-content.js scripts/test-site-content.mjs
git commit -m "feat(content): site-content parse/group helper (tested)"
```

---

### Task 3: Public read API `functions/api/content/index.js`

**Files:**
- Create: `functions/api/content/index.js`

- [ ] **Step 1: Create the endpoint**

Create `functions/api/content/index.js`:
```js
// GET /api/content — published editable page content, grouped by type.

import { ok } from '../../_lib/respond.js'
import { groupContent } from '../../_lib/site-content.js'

export async function onRequestGet({ env }) {
  const { results } = await env.DB
    .prepare('SELECT id, type, data, sort, published FROM site_content WHERE published = 1 ORDER BY type ASC, sort ASC, created_at ASC')
    .all()
  return ok(groupContent(results))
}
```

- [ ] **Step 2: Verify + commit**

Run: `node --check functions/api/content/index.js` (expect no output), then:
```bash
git add functions/api/content/index.js
git commit -m "feat(content): public GET /api/content"
```

---

### Task 4: Admin API `functions/api/org/content.js`

**Files:**
- Create: `functions/api/org/content.js`

- [ ] **Step 1: Create the endpoint**

Create `functions/api/org/content.js`:
```js
// /api/org/content — admin CRUD for editable page content.
//   GET                    -> { process, faq, testimonial }  (incl. unpublished)
//   POST { action, ... }   -> create | update | delete

import { ok, fail, readJson } from '../../_lib/respond.js'
import { uid, now, clampStr } from '../../_lib/util.js'
import { currentOrganizer, currentEditor } from '../../_lib/auth.js'
import { groupContent, CONTENT_TYPES } from '../../_lib/site-content.js'
import { logActivity } from '../../_lib/activity.js'

const normData = (obj) => {
  const o = {}
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) o[clampStr(String(k), 40)] = clampStr(String(v ?? ''), 4000)
  }
  return JSON.stringify(o)
}

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const { results } = await env.DB
    .prepare('SELECT id, type, data, sort, published FROM site_content ORDER BY type ASC, sort ASC, created_at ASC')
    .all()
  return ok(groupContent(results))
}

export async function onRequestPost({ request, env }) {
  const org = await currentEditor(request, env)
  if (!org) return fail("Read-only access — this action isn't available.", 403)
  const db = env.DB
  const body = await readJson(request)
  const action = body.action

  if (action === 'create') {
    const type = clampStr(body.type, 20)
    if (!CONTENT_TYPES.includes(type)) return fail('Invalid type', 422)
    const id = uid('sc_')
    await db.prepare('INSERT INTO site_content (id, type, data, sort, published, created_at) VALUES (?,?,?,?,?,?)')
      .bind(id, type, normData(body.data), parseInt(body.sort) || 0, body.published === false ? 0 : 1, now()).run()
    await logActivity(db, { actor: org.email, action: 'content.create', entityType: 'content', entityId: id, detail: `${type} item added` })
    return ok({ id })
  }

  if (action === 'update') {
    const id = clampStr(body.id, 60)
    const existing = await db.prepare('SELECT id FROM site_content WHERE id = ?').bind(id).first()
    if (!existing) return fail('Item not found', 404)
    await db.prepare('UPDATE site_content SET data=?, sort=?, published=? WHERE id=?')
      .bind(normData(body.data), parseInt(body.sort) || 0, body.published === false ? 0 : 1, id).run()
    await logActivity(db, { actor: org.email, action: 'content.update', entityType: 'content', entityId: id, detail: 'content item updated' })
    return ok({ id })
  }

  if (action === 'delete') {
    const id = clampStr(body.id, 60)
    const ex = await db.prepare('SELECT id FROM site_content WHERE id = ?').bind(id).first()
    if (!ex) return fail('Item not found', 404)
    await db.prepare('DELETE FROM site_content WHERE id = ?').bind(id).run()
    await logActivity(db, { actor: org.email, action: 'content.delete', entityType: 'content', entityId: id, detail: 'content item deleted' })
    return ok({ deleted: true })
  }

  return fail('Unknown action', 422)
}
```

- [ ] **Step 2: Verify + commit**

Run: `node --check functions/api/org/content.js` (expect no output), then:
```bash
git add functions/api/org/content.js
git commit -m "feat(org): admin content CRUD endpoint"
```

---

### Task 5: API client methods

**Files:**
- Modify: `src/lib/api.js`

- [ ] **Step 1: Add the three methods**

In `src/lib/api.js`, immediately after the `orgServiceAction: (payload) => request('/org/services', { method: 'POST', body: payload }),` line, add:
```js
  content: () => request('/content'),
  orgContent: () => request('/org/content'),
  orgContentAction: (payload) => request('/org/content', { method: 'POST', body: payload }),
```

- [ ] **Step 2: Verify + commit**

Run: `node --check src/lib/api.js` (expect no output), then:
```bash
git add src/lib/api.js
git commit -m "feat(api): content + orgContent + orgContentAction client methods"
```

---

### Task 6: Admin page `OrgContent.jsx` + route + nav

**Files:**
- Create: `src/pages/OrgContent.jsx`
- Modify: `src/main.jsx`
- Modify: `src/pages/OrgDashboard.jsx`

- [ ] **Step 1: Create the admin page**

Create `src/pages/OrgContent.jsx`:
```jsx
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import Field from '../components/ui/Field.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { ArrowLeft, Spinner, Lock } from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'
import { useAuth } from '../lib/AuthContext.jsx'

const SECTIONS = [
  { type: 'process', label: 'Process steps', fields: [{ key: 'title', label: 'Title' }, { key: 'desc', label: 'Description', textarea: true }] },
  { type: 'faq', label: 'FAQ', fields: [{ key: 'q', label: 'Question' }, { key: 'a', label: 'Answer', textarea: true }] },
  { type: 'testimonial', label: 'Testimonials', fields: [{ key: 'quote', label: 'Quote', textarea: true }, { key: 'name', label: 'Name' }, { key: 'event', label: 'Event' }] },
]

function ItemEditor({ section, item, canWrite, onSaved, onDelete, isNew }) {
  const [f, setF] = useState(() => ({ ...item }))
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const save = async () => {
    setBusy(true)
    const data = {}
    for (const fl of section.fields) data[fl.key] = f[fl.key] || ''
    try {
      await api.orgContentAction({ action: isNew ? 'create' : 'update', id: isNew ? undefined : item.id, type: section.type, data, sort: parseInt(f.sort) || 0, published: f.published !== false })
      if (isNew) { const cleared = { sort: parseInt(f.sort) || 0, published: true }; setF(cleared) }
      onSaved()
    } catch { /* noop */ } finally { setBusy(false) }
  }
  return (
    <div className={`rounded-2xl border p-5 space-y-3 ${isNew ? 'border-dashed border-plum/20 bg-cream' : 'bg-cream-deep border-plum/8'}`}>
      {section.fields.map((fl) => (
        fl.textarea
          ? <Field key={fl.key} as="textarea" rows="2" label={fl.label} value={f[fl.key] || ''} onChange={(e) => set(fl.key, e.target.value)} />
          : <Field key={fl.key} label={fl.label} value={f[fl.key] || ''} onChange={(e) => set(fl.key, e.target.value)} />
      ))}
      <div className="flex flex-wrap items-center gap-4 text-sm text-ink/70">
        <label className="inline-flex items-center gap-2">Sort <input type="number" value={f.sort ?? 0} onChange={(e) => set('sort', e.target.value)} className="w-16 rounded-lg border border-plum/15 bg-cream px-2 py-1" /></label>
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={f.published !== false} onChange={(e) => set('published', e.target.checked)} /> Published</label>
        <div className="ml-auto flex items-center gap-2">
          {!isNew && <button type="button" onClick={onDelete} disabled={!canWrite} className="text-xs rounded-full border border-terracotta/30 px-3 py-1.5 text-terracotta disabled:opacity-50">Delete</button>}
          <Button onClick={save} variant={isNew ? 'outline' : 'primary'} size="sm" loading={busy} disabled={!canWrite}>{isNew ? 'Add' : 'Save'}</Button>
        </div>
      </div>
    </div>
  )
}

export default function OrgContent() {
  const { client } = useAuth()
  const canWrite = client?.canWrite !== false
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')

  const load = useCallback(async () => {
    try { setData(await api.orgContent()); setState('ok') }
    catch (e) { setState(e instanceof ApiError && (e.status === 401 || e.status === 403) ? 'forbidden' : 'error') }
  }, [])
  useEffect(() => { load() }, [load])

  const del = async (id) => { if (!confirm('Delete this item?')) return; try { await api.orgContentAction({ action: 'delete', id }); await load() } catch { /* noop */ } }

  if (state === 'loading') return <div className="min-h-dvh grid place-items-center text-plum"><Spinner size={32} /></div>
  if (state === 'forbidden') return (
    <Section tone="cream" className="min-h-dvh grid place-items-center"><Container className="text-center max-w-md">
      <Lock size={36} className="text-terracotta mx-auto" />
      <h1 className="font-display text-plum text-3xl mt-4">Organizer access only</h1>
      <Button to="/login" variant="primary" size="md" className="mt-6">Sign in</Button>
    </Container></Section>
  )
  if (state === 'error') return <div className="min-h-dvh grid place-items-center text-terracotta">Couldn&apos;t load content.</div>

  return (
    <>
      <Seo title="Content · Organizer" noindex />
      <section className="bg-plum-deep text-cream pt-32 pb-10">
        <Container>
          <Link to="/org" className="inline-flex items-center gap-2 text-cream/70 hover:text-cream text-sm mb-5"><ArrowLeft size={16} /> Dashboard</Link>
          <h1 className="font-display text-4xl sm:text-5xl">Content</h1>
          <p className="text-cream/70 mt-2">Edit the Process steps, FAQ, and testimonials shown on your public pages.</p>
        </Container>
      </section>

      <Section tone="cream" pad="md">
        <Container className="max-w-3xl space-y-12">
          {SECTIONS.map((sec) => (
            <div key={sec.type}>
              <h2 className="font-display text-plum text-2xl mb-4">{sec.label}</h2>
              <div className="space-y-3">
                {(data[sec.type] || []).map((item) => (
                  <ItemEditor key={item.id} section={sec} item={item} canWrite={canWrite} onSaved={load} onDelete={() => del(item.id)} />
                ))}
                {canWrite && (
                  <ItemEditor key={`new-${sec.type}`} section={sec} item={{ sort: (data[sec.type]?.length || 0) + 1, published: true }} canWrite={canWrite} onSaved={load} isNew />
                )}
              </div>
            </div>
          ))}
        </Container>
      </Section>
    </>
  )
}
```

- [ ] **Step 2: Register the route**

In `src/main.jsx`, add the import near the other org page imports:
```jsx
import OrgContent from './pages/OrgContent.jsx'
```
Then add the route immediately AFTER the `/org/services` `<Route>` block and before `<Route path="*" …>`:
```jsx
            <Route
              path="/org/content"
              element={
                <ProtectedRoute>
                  <OrgContent />
                </ProtectedRoute>
              }
            />
```

- [ ] **Step 3: Add the dashboard quick-link**

In `src/pages/OrgDashboard.jsx`, the Services quick-link is:
```jsx
            <Link to="/org/services" className="text-sm rounded-full bg-cream/10 hover:bg-cream/20 text-cream px-4 py-1.5 transition-colors">Services</Link>
```
Immediately AFTER it, add:
```jsx
            <Link to="/org/content" className="text-sm rounded-full bg-cream/10 hover:bg-cream/20 text-cream px-4 py-1.5 transition-colors">Content</Link>
```

- [ ] **Step 4: Build + commit**

Run: `npm run build` (expect exit 0), then:
```bash
git add src/pages/OrgContent.jsx src/main.jsx src/pages/OrgDashboard.jsx
git commit -m "feat(org): /org/content admin page (process/faq/testimonials) + nav"
```

---

### Task 7: Rewire public components + content.js cleanup

**Files:**
- Modify: `src/components/sections/FAQ.jsx`
- Modify: `src/components/sections/Testimonials.jsx`
- Modify: `src/pages/Services.jsx`
- Modify: `src/lib/content.js`

- [ ] **Step 1: `FAQ.jsx` fetches its items**

In `src/components/sections/FAQ.jsx`, change the imports:
```jsx
import { useState, useId } from 'react'
...
import { faqs } from '../../lib/content.js'
```
to:
```jsx
import { useState, useEffect, useId } from 'react'
...
import { api } from '../../lib/api.js'
```
(keep the `Section, Container, Eyebrow` and `ChevronDown` imports; the `Item` component is unchanged.)

Then replace the `FAQ` default export function's body so it fetches and guards on empty:
```jsx
export default function FAQ() {
  const [openIdx, setOpenIdx] = useState(0)
  const [faqs, setFaqs] = useState(null)
  useEffect(() => {
    let cancelled = false
    api.content().then((r) => { if (!cancelled) setFaqs(r.faq || []) }).catch(() => { if (!cancelled) setFaqs([]) })
    return () => { cancelled = true }
  }, [])
  if (!faqs || faqs.length === 0) return null

  return (
    <Section tone="cream" id="faq">
      <Container className="max-w-3xl">
        <div className="text-center mb-12">
          <Eyebrow className="text-terracotta mb-4">Questions</Eyebrow>
          <h2 className="font-display text-plum text-4xl sm:text-5xl leading-tight">
            Things clients often <span className="italic">ask</span>
          </h2>
        </div>
        <div>
          {faqs.map((f, i) => (
            <Item key={f.id} q={f.q} a={f.a} open={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? -1 : i)} />
          ))}
        </div>
      </Container>
    </Section>
  )
}
```

- [ ] **Step 2: `Testimonials.jsx` fetches its items**

In `src/components/sections/Testimonials.jsx`, change the imports:
```jsx
import { Section, Container, Eyebrow } from '../ui/Section.jsx'
import Reveal from '../ui/Reveal.jsx'
import { Quote, Star } from '../../lib/icons.jsx'
import { testimonials } from '../../lib/content.js'
```
to:
```jsx
import { useState, useEffect } from 'react'
import { Section, Container, Eyebrow } from '../ui/Section.jsx'
import Reveal from '../ui/Reveal.jsx'
import { Quote, Star } from '../../lib/icons.jsx'
import { api } from '../../lib/api.js'
```
Then change the component to fetch and guard, and key rows by `t.id`:
```jsx
export default function Testimonials({ tone = 'creamDeep' }) {
  const [testimonials, setTestimonials] = useState(null)
  useEffect(() => {
    let cancelled = false
    api.content().then((r) => { if (!cancelled) setTestimonials(r.testimonial || []) }).catch(() => { if (!cancelled) setTestimonials([]) })
    return () => { cancelled = true }
  }, [])
  if (!testimonials || testimonials.length === 0) return null

  return (
    <Section tone={tone}>
      <Container>
        <div className="max-w-2xl mb-14">
          <Eyebrow className="text-terracotta mb-4">Kind words</Eyebrow>
          <h2 className="font-display text-plum text-4xl sm:text-5xl leading-tight text-balance">
            Trusted with the moments that <span className="italic">matter most</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <Reveal key={t.id} delay={i * 90} className="flex flex-col rounded-2xl bg-cream p-8 shadow-sm border border-plum/5">
              <Quote size={28} className="text-champagne" />
              <div className="mt-3 flex gap-0.5 text-champagne" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} size={15} className="fill-champagne" />
                ))}
              </div>
              <blockquote className="mt-4 text-ink/80 leading-relaxed flex-1">“{t.quote}”</blockquote>
              <div className="mt-6 pt-5 border-t border-plum/10">
                <p className="font-display text-plum text-lg">{t.name}</p>
                <p className="text-ink/50 text-sm">{t.event}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  )
}
```

- [ ] **Step 3: `Services.jsx` fetches the Process list**

In `src/pages/Services.jsx`, remove the hardcoded `const process = [ … ]` array (the four-item constant near the top of the file).

In the `Services` default export component, after the existing `const [services, setServices] = useState(null)` line, add a process state + fetch:
```jsx
  const [process, setProcess] = useState(null)
  useEffect(() => {
    let cancelled = false
    api.content().then((r) => { if (!cancelled) setProcess(r.process || []) }).catch(() => { if (!cancelled) setProcess([]) })
    return () => { cancelled = true }
  }, [])
```
Then, in the "process" `<Section tone="plum">`, change the steps map so it reads from state and auto-numbers. The current block is:
```jsx
            {process.map((p, i) => (
              <Reveal key={p.n} delay={i * 80}>
                <div className="font-display italic text-champagne text-3xl mb-4">{p.n}</div>
                <h3 className="font-display text-2xl mb-3">{p.title}</h3>
                <p className="text-cream/60 leading-relaxed text-sm">{p.desc}</p>
              </Reveal>
            ))}
```
Change it to:
```jsx
            {(process || []).map((p, i) => (
              <Reveal key={p.id} delay={i * 80}>
                <div className="font-display italic text-champagne text-3xl mb-4">0{i + 1}</div>
                <h3 className="font-display text-2xl mb-3">{p.title}</h3>
                <p className="text-cream/60 leading-relaxed text-sm">{p.desc}</p>
              </Reveal>
            ))}
```
(The `api` and `useEffect` imports are already present in `Services.jsx` from Phase A.)

- [ ] **Step 4: Remove the now-unused exports from `content.js`**

In `src/lib/content.js`, delete the entire `export const testimonials = [ … ]` block and the entire `export const faqs = [ … ]` block. Leave any remaining exports (e.g. `fmtGhs`) intact.

- [ ] **Step 5: Verify + build + commit**

Run: `grep -rn "from '../../lib/content.js'\|from '../lib/content.js'" src/` — expect NO import that pulls `faqs` or `testimonials` (there should be no remaining importers of `content.js` for these).
Run: `grep -rn "export const faqs\|export const testimonials" src/lib/content.js` — expect no matches.
Run: `npm run build` (expect exit 0), then:
```bash
git add src/components/sections/FAQ.jsx src/components/sections/Testimonials.jsx src/pages/Services.jsx src/lib/content.js
git commit -m "feat(content): rewire FAQ/testimonials/process to the content API"
```

---

### Task 8: Migrate live D1, deploy, verify

**Files:** none (operational). Requires the correct wrangler login (**ghwmelite@gmail.com / acct ea2eb3a9…**).

- [ ] **Step 1: Tests + build**

Run: `node scripts/test-site-content.mjs && npm run build`
Expected: `OK: site-content helper assertions passed` then a clean build.

- [ ] **Step 2: Migrate the live D1**

Run:
```bash
npx wrangler d1 execute gather-ghana --remote --yes --file=./migrations/add-site-content.sql
```
Expected: success. (Re-runnable — `IF NOT EXISTS` + `INSERT OR IGNORE`.)

- [ ] **Step 3: Deploy to production**

Run: `npx wrangler pages deploy dist --project-name gather-ghana-events --branch main`
Expected: "Deployment complete".

- [ ] **Step 4: Manual verification on production**

1. `GET https://gge.ohwpstudios.org/api/content` returns `process` (4), `faq` (5), `testimonial` (3).
2. `/services` shows the Process steps + FAQ; the homepage shows the 3 testimonials — all as before, now DB-driven.
3. `/org/content` (organizer): edit an FAQ answer → reflected on `/services`; add a testimonial → shows on the homepage; unpublish a process step → it disappears; change a `sort` → order updates.
4. As a **viewer** (read-only): `/org/content` lists content but Add/Save/Delete are disabled; a direct `POST /api/org/content` returns 403.

- [ ] **Step 5: Finish the branch**

Use `superpowers:finishing-a-development-branch` to merge `feat/site-content` to `main` (and push).

---

## Self-Review Notes

- **Spec coverage:** table + seed → Task 1; `parseData`/`groupContent` (+test) → Task 2; public GET →
  Task 3; admin GET/POST create/update/delete (currentEditor, type whitelist) → Task 4; api client →
  Task 5; OrgContent page + route + nav → Task 6; rewire FAQ/Testimonials/Services(process) +
  content.js cleanup → Task 7; live migration + deploy → Task 8. All covered.
- **Name consistency:** `parseData`/`groupContent`/`CONTENT_TYPES` defined in Task 2, used in Tasks
  3 & 4; response shape `{ process, faq, testimonial }` with items `{ id, ...data, sort, published }`
  produced by Tasks 3/4 and consumed by the admin page (Task 6) and public components (Task 7); action
  strings `create|update|delete` match between endpoint (Task 4) and page (Task 6). The per-type field
  configs in `SECTIONS` (Task 6) match the `data` shapes in the seed (Task 1) and the fields the public
  components read (Task 7): process `{title,desc}`, faq `{q,a}`, testimonial `{quote,name,event}`.
- **Build stays green:** api methods (Task 5) precede the page/components using them (Tasks 6–7);
  `content.js` exports removed only after all importers switch to the API (both in Task 7), with grep
  guards.
- **Viewer role respected:** create/update/delete via `currentEditor` (403), and every mutating
  control is `disabled={!canWrite}`.
