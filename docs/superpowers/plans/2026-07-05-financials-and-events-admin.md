# Financials Rename + Admin Events Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the "Books" admin screen to "Financials", and give event-page creation a proper, organizer-gated home — a dedicated `/org/events` admin page (create + list + delete) plus a shared creation helper.

**Architecture:** Extract the event INSERT into `functions/_lib/events.js` (shared by the public and a new admin endpoint). Add organizer-gated `functions/api/org/events.js` (GET list / POST create+delete via `currentEditor`). New `OrgEvents.jsx` page + route; the dashboard's buried create form is replaced by a CTA. Rename is label-only (URL unchanged).

**Tech Stack:** React + Vite SPA, Cloudflare Pages Functions, D1, Tailwind. Verified by `npm run build`, `node --check`, and manual smoke test.

**Spec:** `docs/superpowers/specs/2026-07-05-financials-and-events-admin-design.md`

**Branch:** Create `feat/financials-events-admin` off `main` before Task 1.

---

## File Structure

- `src/pages/OrgDashboard.jsx`, `src/pages/OrgClient.jsx`, `src/pages/OrgBooks.jsx` — rename Books→Financials (modify).
- `functions/_lib/events.js` — shared `createEventRecord` helper (create).
- `functions/api/events/index.js` — delegate to the helper (modify).
- `functions/api/org/events.js` — admin GET/POST endpoint (create).
- `src/lib/api.js` — `orgEvents` + `orgEventAction` (modify).
- `src/pages/OrgEvents.jsx` — the admin events page (create).
- `src/main.jsx` — `/org/events` route (modify).
- `src/pages/OrgDashboard.jsx` — Events nav link + remove `CreateEvent`, add CTA (modify).

---

### Task 1: Rename "Books" → "Financials" (labels only)

**Files:**
- Modify: `src/pages/OrgDashboard.jsx:149`
- Modify: `src/pages/OrgClient.jsx:194`
- Modify: `src/pages/OrgBooks.jsx:87,93`

- [ ] **Step 1: Dashboard quick-link label**

In `src/pages/OrgDashboard.jsx`, change:
```jsx
            <Link to="/org/books" className="text-sm rounded-full bg-cream/10 hover:bg-cream/20 text-cream px-4 py-1.5 transition-colors">Books</Link>
```
to:
```jsx
            <Link to="/org/books" className="text-sm rounded-full bg-cream/10 hover:bg-cream/20 text-cream px-4 py-1.5 transition-colors">Financials</Link>
```

- [ ] **Step 2: OrgClient link label**

In `src/pages/OrgClient.jsx`, change:
```jsx
                <Link to="/org/books" className="text-sm text-terracotta inline-flex items-center gap-1 link-underline">Books <ArrowRight size={14} /></Link>
```
to:
```jsx
                <Link to="/org/books" className="text-sm text-terracotta inline-flex items-center gap-1 link-underline">Financials <ArrowRight size={14} /></Link>
```

- [ ] **Step 3: OrgBooks SEO title + heading**

In `src/pages/OrgBooks.jsx`, change:
```jsx
      <Seo title="Books · Organizer" noindex />
```
to:
```jsx
      <Seo title="Financials · Organizer" noindex />
```
and change:
```jsx
              <h1 className="font-display text-4xl sm:text-5xl">Books</h1>
```
to:
```jsx
              <h1 className="font-display text-4xl sm:text-5xl">Financials</h1>
```

- [ ] **Step 4: Build + commit**

Run: `npm run build` (expect exit 0), then:
```bash
git add src/pages/OrgDashboard.jsx src/pages/OrgClient.jsx src/pages/OrgBooks.jsx
git commit -m "feat(org): rename Books to Financials"
```

---

### Task 2: Shared `createEventRecord` helper + public endpoint refactor

**Files:**
- Create: `functions/_lib/events.js`
- Modify: `functions/api/events/index.js`

- [ ] **Step 1: Create the helper**

Create `functions/_lib/events.js`:
```js
// Shared creation of a public event-page record. Used by the public (self-serve) and admin endpoints.

import { uid, now, clampStr } from './util.js'
import { isCurrency } from './money.js'

const slugify = (s) =>
  clampStr(s, 60)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'event'

const VISIBILITY = ['public', 'unlisted', 'private']

/**
 * Insert an event (+ optional schedule items) and return { id, slug }.
 * Throws an Error with `.status = 422` and `.fields` when the title is missing.
 */
export async function createEventRecord(db, ownerEmail, body) {
  const title = clampStr(body.title, 120)
  if (!title) {
    const err = new Error('A title is required')
    err.status = 422
    err.fields = { title: 'Title is required' }
    throw err
  }
  const currency = isCurrency(body.currency) ? body.currency : 'GHS'
  const visibility = VISIBILITY.includes(body.visibility) ? body.visibility : 'public'
  const goal = Math.max(0, Math.round(Number(body.contribution_goal) || 0)) // minor units

  const slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`
  const id = uid('evt_')
  const ts = now()

  await db
    .prepare(
      `INSERT INTO events
       (id, slug, owner_email, inquiry_id, title, host_names, event_type, event_date,
        start_time, venue, location, cover_image, story, currency, visibility,
        rsvp_enabled, contributions_enabled, contribution_goal, livestream_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id, slug, ownerEmail || null, clampStr(body.inquiry_id, 60) || null,
      title, clampStr(body.host_names, 160), clampStr(body.event_type, 40),
      clampStr(body.event_date, 20), clampStr(body.start_time, 20),
      clampStr(body.venue, 160), clampStr(body.location, 160),
      clampStr(body.cover_image, 400), clampStr(body.story, 4000), currency, visibility,
      body.rsvp_enabled === false ? 0 : 1,
      body.contributions_enabled === false ? 0 : 1,
      goal, clampStr(body.livestream_url, 400), ts
    )
    .run()

  if (Array.isArray(body.schedule)) {
    for (const [i, item] of body.schedule.slice(0, 30).entries()) {
      await db
        .prepare('INSERT INTO event_schedule (id, event_id, time, title, description, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(uid('sch_'), id, clampStr(item.time, 20), clampStr(item.title, 120), clampStr(item.description, 500), i, ts)
        .run()
    }
  }
  return { id, slug }
}
```

- [ ] **Step 2: Refactor the public endpoint to use the helper**

Replace the entire contents of `functions/api/events/index.js` with:
```js
// POST /api/events — create a shareable event (auth: a signed-in planner/client).

import { ok, fail, readJson } from '../../_lib/respond.js'
import { currentClientId } from '../../_lib/auth.js'
import { createEventRecord } from '../../_lib/events.js'

export async function onRequestPost({ request, env }) {
  const clientId = await currentClientId(request, env)
  if (!clientId) return fail('Not signed in', 401)

  const db = env.DB
  const owner = await db.prepare('SELECT email FROM clients WHERE id = ?').bind(clientId).first()
  const body = await readJson(request)
  try {
    const res = await createEventRecord(db, owner?.email || null, body)
    return ok(res)
  } catch (e) {
    if (e.status === 422) return fail(e.message, 422, { fields: e.fields })
    throw e
  }
}
```

- [ ] **Step 3: Verify + commit**

Run: `node --check functions/_lib/events.js && node --check functions/api/events/index.js` (expect no output), then:
```bash
git add functions/_lib/events.js functions/api/events/index.js
git commit -m "refactor(events): extract createEventRecord helper (shared)"
```

---

### Task 3: Admin events endpoint `functions/api/org/events.js`

**Files:**
- Create: `functions/api/org/events.js`

- [ ] **Step 1: Create the endpoint**

Create `functions/api/org/events.js`:
```js
// /api/org/events — admin listing + create/delete of public event pages.
//   GET                    -> { events }
//   POST { action, ... }   -> create | delete

import { ok, fail, readJson } from '../../_lib/respond.js'
import { clampStr } from '../../_lib/util.js'
import { currentOrganizer, currentEditor } from '../../_lib/auth.js'
import { createEventRecord } from '../../_lib/events.js'
import { logActivity } from '../../_lib/activity.js'

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const { results } = await env.DB
    .prepare(
      `SELECT id, slug, title, host_names, event_type, event_date, visibility, created_at
       FROM events ORDER BY created_at DESC LIMIT 200`
    )
    .all()
  return ok({ events: results })
}

export async function onRequestPost({ request, env }) {
  const org = await currentEditor(request, env)
  if (!org) return fail("Read-only access — this action isn't available.", 403)
  const db = env.DB
  const body = await readJson(request)
  const action = body.action

  if (action === 'create') {
    try {
      const res = await createEventRecord(db, org.email, body)
      await logActivity(db, {
        actor: org.email, action: 'event.create', entityType: 'event', entityId: res.id,
        detail: `Event page "${clampStr(body.title, 120)}" created (/e/${res.slug})`,
      })
      return ok(res)
    } catch (e) {
      if (e.status === 422) return fail(e.message, 422, { fields: e.fields })
      throw e
    }
  }

  if (action === 'delete') {
    const id = clampStr(body.id, 60)
    const ev = await db.prepare('SELECT id, slug, title FROM events WHERE id = ?').bind(id).first()
    if (!ev) return fail('Event not found', 404)
    await db.batch([
      db.prepare('DELETE FROM event_schedule WHERE event_id = ?').bind(id),
      db.prepare('DELETE FROM event_gallery WHERE event_id = ?').bind(id),
      db.prepare('DELETE FROM rsvps WHERE event_id = ?').bind(id),
      db.prepare('DELETE FROM contributions WHERE event_id = ?').bind(id),
      db.prepare('DELETE FROM events WHERE id = ?').bind(id),
    ])
    await logActivity(db, {
      actor: org.email, action: 'event.delete', entityType: 'event', entityId: id,
      detail: `Event page "${ev.title}" deleted (/e/${ev.slug})`,
    })
    return ok({ deleted: true })
  }

  return fail('Unknown action', 422)
}
```

- [ ] **Step 2: Verify + commit**

Run: `node --check functions/api/org/events.js` (expect no output), then:
```bash
git add functions/api/org/events.js
git commit -m "feat(org): admin events endpoint (list/create/delete, organizer-gated)"
```

---

### Task 4: API client methods

**Files:**
- Modify: `src/lib/api.js`

- [ ] **Step 1: Add the two methods**

In `src/lib/api.js`, immediately after the `orgActivity: (query = {}) => { … },` block (the last organizer method before the Proposals section), add:
```js
  orgEvents: () => request('/org/events'),
  orgEventAction: (payload) => request('/org/events', { method: 'POST', body: payload }),
```

- [ ] **Step 2: Verify + commit**

Run: `node --check src/lib/api.js` (expect no output), then:
```bash
git add src/lib/api.js
git commit -m "feat(api): orgEvents + orgEventAction client methods"
```

---

### Task 5: `OrgEvents.jsx` page + route

**Files:**
- Create: `src/pages/OrgEvents.jsx`
- Modify: `src/main.jsx`

- [ ] **Step 1: Create the page**

Create `src/pages/OrgEvents.jsx`:
```jsx
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import Field from '../components/ui/Field.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { ArrowLeft, ArrowRight, Spinner, Lock, CheckCircle } from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'
import { toMinor } from '../lib/money.js'
import { useAuth } from '../lib/AuthContext.jsx'

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const EMPTY = { title: '', host_names: '', event_type: 'Wedding', event_date: '', venue: '', location: '', goal: '' }

export default function OrgEvents() {
  const { client } = useAuth()
  const canWrite = client?.canWrite !== false
  const [events, setEvents] = useState([])
  const [state, setState] = useState('loading')
  const [f, setF] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [made, setMade] = useState(null)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try { const r = await api.orgEvents(); setEvents(r.events || []); setState('ok') }
    catch (e) { setState(e instanceof ApiError && (e.status === 401 || e.status === 403) ? 'forbidden' : 'error') }
  }, [])
  useEffect(() => { load() }, [load])

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const create = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      const res = await api.orgEventAction({ action: 'create', ...f, contribution_goal: toMinor(parseFloat(f.goal) || 0, 'GHS') })
      setMade(res.slug); setF(EMPTY); await load()
    } catch (e2) { setErr(e2 instanceof ApiError ? e2.message : 'Could not create the event.') }
    finally { setBusy(false) }
  }
  const remove = async (ev) => {
    if (!confirm(`Delete the event page "${ev.title}"? This can't be undone.`)) return
    try { await api.orgEventAction({ action: 'delete', id: ev.id }); await load() } catch { /* noop */ }
  }

  if (state === 'loading') return <div className="min-h-dvh grid place-items-center text-plum"><Spinner size={32} /></div>
  if (state === 'forbidden') return (
    <Section tone="cream" className="min-h-dvh grid place-items-center"><Container className="text-center max-w-md">
      <Lock size={36} className="text-terracotta mx-auto" />
      <h1 className="font-display text-plum text-3xl mt-4">Organizer access only</h1>
      <Button to="/login" variant="primary" size="md" className="mt-6">Sign in</Button>
    </Container></Section>
  )
  if (state === 'error') return <div className="min-h-dvh grid place-items-center text-terracotta">Couldn&apos;t load events.</div>

  return (
    <>
      <Seo title="Events · Organizer" noindex />
      <section className="bg-plum-deep text-cream pt-32 pb-10">
        <Container>
          <Link to="/org" className="inline-flex items-center gap-2 text-cream/70 hover:text-cream text-sm mb-5"><ArrowLeft size={16} /> Dashboard</Link>
          <h1 className="font-display text-4xl sm:text-5xl">Events</h1>
          <p className="text-cream/70 mt-2">Create and manage shareable event pages.</p>
        </Container>
      </section>

      <Section tone="cream" pad="md">
        <Container className="grid lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-3">
            {events.length === 0 ? (
              <div className="rounded-3xl bg-cream-deep border border-plum/8 p-8 text-ink/55">No event pages yet — create your first one.</div>
            ) : events.map((e) => (
              <div key={e.id} className="rounded-2xl bg-cream-deep border border-plum/8 p-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-plum">{e.host_names || e.title}</p>
                  <p className="text-ink/50 text-xs">{e.event_type || 'Event'} · {fmtDate(e.event_date)} · {e.visibility}</p>
                </div>
                <div className="flex items-center gap-3">
                  <a href={`/e/${e.slug}`} target="_blank" rel="noopener noreferrer" className="text-terracotta text-sm inline-flex items-center gap-1 link-underline">View <ArrowRight size={14} /></a>
                  <button onClick={() => remove(e)} disabled={!canWrite} className="text-xs rounded-full border border-terracotta/30 px-3 py-1.5 text-terracotta disabled:opacity-50">Delete</button>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:sticky lg:top-28">
            {made ? (
              <div className="rounded-3xl bg-plum text-cream p-7">
                <CheckCircle size={28} className="text-champagne-light" />
                <p className="mt-2">Event page created.</p>
                <a href={`/e/${made}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-champagne-light link-underline">/e/{made} <ArrowRight size={16} /></a>
                <button onClick={() => setMade(null)} className="block mt-4 text-sm text-cream/70 link-underline">Create another</button>
              </div>
            ) : (
              <form onSubmit={create} className="rounded-3xl bg-cream-deep border border-plum/8 p-7 space-y-4">
                <h2 className="font-display text-plum text-xl">Create an event page</h2>
                <Field label="Title" required value={f.title} onChange={set('title')} placeholder="The Wedding of Ama & Kojo" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Host names" value={f.host_names} onChange={set('host_names')} placeholder="Ama & Kojo" />
                  <Field label="Type" value={f.event_type} onChange={set('event_type')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date" type="date" value={f.event_date} onChange={set('event_date')} />
                  <Field label="Goal (GH₵)" type="number" value={f.goal} onChange={set('goal')} placeholder="20000" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Venue" value={f.venue} onChange={set('venue')} />
                  <Field label="Location" value={f.location} onChange={set('location')} />
                </div>
                {err && <p role="alert" className="text-sm text-terracotta">{err}</p>}
                <Button type="submit" variant="primary" size="sm" loading={busy} disabled={!canWrite} className="w-full">Create page</Button>
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

In `src/main.jsx`, add the import alongside the other org page imports (near `import OrgBooks from './pages/OrgBooks.jsx'`):
```jsx
import OrgEvents from './pages/OrgEvents.jsx'
```
Then add the route immediately AFTER the `/org/books` `<Route>` block and BEFORE `<Route path="*" element={<NotFound />} />`:
```jsx
            <Route
              path="/org/events"
              element={
                <ProtectedRoute>
                  <OrgEvents />
                </ProtectedRoute>
              }
            />
```

- [ ] **Step 3: Build + commit**

Run: `npm run build` (expect exit 0), then:
```bash
git add src/pages/OrgEvents.jsx src/main.jsx
git commit -m "feat(org): dedicated /org/events admin page (create + list + delete)"
```

---

### Task 6: Dashboard — Events nav link, replace create form with CTA

**Files:**
- Modify: `src/pages/OrgDashboard.jsx`

- [ ] **Step 1: Add "Events" to the quick-link nav**

In `src/pages/OrgDashboard.jsx`, the Tasks quick-link is:
```jsx
            <Link to="/org/tasks" className="text-sm rounded-full bg-cream/10 hover:bg-cream/20 text-cream px-4 py-1.5 transition-colors">Tasks{data.stats.openTasks ? ` (${data.stats.openTasks})` : ''}</Link>
```
Immediately AFTER it, add:
```jsx
            <Link to="/org/events" className="text-sm rounded-full bg-cream/10 hover:bg-cream/20 text-cream px-4 py-1.5 transition-colors">Events</Link>
```

- [ ] **Step 2: Replace the inline `CreateEvent` render with a CTA**

Change:
```jsx
              <CreateEvent onCreated={load} canWrite={canWrite} />
```
to:
```jsx
              <Link to="/org/events" className="block rounded-3xl bg-plum text-cream p-7 hover:bg-plum-soft transition-colors">
                <p className="font-display text-xl">Event pages</p>
                <p className="text-cream/65 text-sm mt-1">Create and manage shareable event pages.</p>
                <span className="mt-4 inline-flex items-center gap-2 text-champagne-light text-sm">New event page <ArrowRight size={16} /></span>
              </Link>
```

- [ ] **Step 3: Remove the now-unused `CreateEvent` component**

Delete the entire `function CreateEvent({ onCreated, canWrite }) { … }` definition (the component spanning from `function CreateEvent(` to its closing `}` just before `function LeadRow(`).

- [ ] **Step 4: Remove the now-unused imports**

`CreateEvent` was the only user of `CheckCircle` and `toMinor`. Change the icons import:
```jsx
import { Users, Calendar, Heart, Lock, Spinner, ArrowRight, CheckCircle, Plus } from '../lib/icons.jsx'
```
to:
```jsx
import { Users, Calendar, Heart, Lock, Spinner, ArrowRight, Plus } from '../lib/icons.jsx'
```
and change the money import:
```jsx
import { formatMoney, toMinor } from '../lib/money.js'
```
to:
```jsx
import { formatMoney } from '../lib/money.js'
```
(`Field`, `Button`, `Plus`, `ArrowRight` are still used by `LeadRow`/the events list — keep them.)

- [ ] **Step 5: Verify + build + commit**

Run: `grep -n "CreateEvent\|CheckCircle\|toMinor" src/pages/OrgDashboard.jsx`
Expected: no matches.
Run: `npm run build` (expect exit 0), then:
```bash
git add src/pages/OrgDashboard.jsx
git commit -m "feat(org): dashboard Events link + CTA to /org/events (remove inline form)"
```

---

### Task 7: Verify + deploy

**Files:** none (operational). Requires the correct wrangler login (**ghwmelite@gmail.com / acct ea2eb3a9…**).

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: exit 0, no errors.

- [ ] **Step 2: Deploy to production**

Run: `npx wrangler pages deploy dist --project-name gather-ghana-events --branch main`
Expected: "Deployment complete". (No D1 migration — code only; `events` and child tables already exist.)

- [ ] **Step 3: Manual verification on production (signed in as an organizer)**

1. Dashboard quick-links show **Financials** (not Books) and **Events**; `/org/books` still loads and its header reads **Financials**.
2. Dashboard sidebar shows the **"New event page"** CTA (no inline form) → `/org/events`.
3. `/org/events`: create an event (title required) → it appears in the list and `/e/<slug>` is live.
4. Delete an event → confirm dialog → it disappears from the list and `/e/<slug>` returns 404.
5. As a **viewer** (read-only role): `/org/events` lists events but the Create button and Delete are disabled; a direct `POST /api/org/events {action:'create'}` returns 403.
6. The public event page flow (existing `/e/:slug`) still works.

- [ ] **Step 4: Finish the branch**

Use `superpowers:finishing-a-development-branch` to merge `feat/financials-events-admin` to `main` (and push).

---

## Self-Review Notes

- **Spec coverage:** A rename → Task 1; B1 helper → Task 2; B2 public refactor → Task 2; B3 admin
  endpoint (GET currentOrganizer, POST currentEditor create/delete, explicit child-row batch delete,
  logActivity) → Task 3; B4 api client → Task 4; B5 OrgEvents page (forbidden state, canWrite gating,
  create + list + delete) → Task 5; B6 route → Task 5; B7 dashboard nav + CTA + form removal → Task 6.
  Testing/manual → Task 7. All covered.
- **Name consistency:** `createEventRecord(db, ownerEmail, body)` defined in Task 2 and called in
  Tasks 2 & 3; `orgEvents`/`orgEventAction` defined in Task 4 and used in Task 5; the create/delete
  action strings (`'create'`/`'delete'`) match between the endpoint (Task 3) and the page (Task 5);
  event fields in the GET select (`host_names`, `event_type`, `event_date`, `visibility`, `slug`)
  match what OrgEvents renders (Task 5).
- **Build stays green:** helper + endpoint (Tasks 2–3) are additive; api methods (Task 4) precede the
  page that uses them (Task 5); the `/org/events` route (Task 5) precedes the dashboard CTA linking to
  it (Task 6); unused imports are removed in the same task that removes their only consumer (Task 6),
  with a grep guard.
- **Viewer role respected:** create/delete go through `currentEditor` (403 for viewers) and the UI
  disables both when `!canWrite` — consistent with the read-only viewer feature.
