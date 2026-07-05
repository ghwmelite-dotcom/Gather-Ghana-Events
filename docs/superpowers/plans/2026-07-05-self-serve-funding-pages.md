# Couple Self-Serve Funding Pages Implementation Plan (Fund-my-Event v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in couple build and share their own funding page from their saved Instant Quote, with an organizer-approval gate before it can accept money.

**Architecture:** Additive on the shipped Fund-my-Event rail. One new column `events.self_serve`. A new client-owned endpoint `functions/api/portal/funding.js` (create/update/import/line CRUD, ownership-guarded). The organizer endpoint gains an `accept_self_serve` action + a pending queue. The public event page shows a read-only funding **preview** until an organizer enables money (`contributions_enabled`). The couple manages everything from a new portal section. Money model unchanged: single Paystack account, organizer disburses, no custody.

**Tech Stack:** Cloudflare Pages Functions, D1 (SQLite), React + Vite SPA, Tailwind. Endpoints verified via `node --check` + manual authenticated API checks; UI via `npm run build` + smoke test. Reuses the already-tested `functions/_lib/funding.js`.

**Spec:** `docs/superpowers/specs/2026-07-05-self-serve-funding-pages-design.md`

**Branch:** Create `feat/self-serve-funding` off `main` before Task 1.

---

## File Structure

- `schema.sql` (modify) + `migrations/add-event-self-serve.sql` (create) — `events.self_serve`.
- `functions/_lib/events.js` (modify) — `createEventRecord` writes `self_serve`.
- `functions/api/events/index.js` (modify) — harden the legacy client create (force safe self-serve values).
- `functions/api/events/[slug].js` (modify) — return `self_serve` in the public read.
- `functions/api/portal/funding.js` (create) — the couple's own funding page: GET + create/update/import_lines/line_upsert/line_delete.
- `functions/api/org/events.js` (modify) — GET returns `self_serve`/`contributions_enabled`; new `accept_self_serve` action.
- `src/lib/api.js` (modify) — `portalFunding` + `portalFundingAction`.
- `src/pages/EventPage.jsx` (modify) — the preview state.
- `src/pages/OrgEvents.jsx` (modify) — pending badge + Accept button.
- `src/pages/Portal.jsx` (modify) — the "Your funding page" section.

---

### Task 1: Schema + migration

**Files:** Modify `schema.sql`; Create `migrations/add-event-self-serve.sql`.

- [ ] **Step 1: Add the column to `schema.sql`**

In `schema.sql`, in the `events` table definition, add a `self_serve` column. Find the `livestream_url` line in the `events` CREATE TABLE and add `self_serve` right after it (before `created_at`). For example, if the events table has:
```sql
  livestream_url    TEXT,
  created_at        INTEGER NOT NULL
```
change it to:
```sql
  livestream_url    TEXT,
  self_serve        INTEGER NOT NULL DEFAULT 0,   -- 1 = couple-built (self-serve) page
  created_at        INTEGER NOT NULL
```
(If the exact column ordering/whitespace differs, keep the existing style — the only requirement is a `self_serve INTEGER NOT NULL DEFAULT 0` column on `events`.)

- [ ] **Step 2: Create the one-off migration**

Create `migrations/add-event-self-serve.sql`:
```sql
-- Self-serve funding pages: mark couple-built event pages.
-- ONE-OFF (ALTER is NOT re-runnable in SQLite — run once on live D1):
--   npx wrangler d1 execute gather-ghana --remote --yes --file=./migrations/add-event-self-serve.sql

ALTER TABLE events ADD COLUMN self_serve INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 3: Commit**
```bash
git add schema.sql migrations/add-event-self-serve.sql
git commit -m "feat(schema): events.self_serve column"
```

---

### Task 2: `createEventRecord` writes `self_serve`

**Files:** Modify `functions/_lib/events.js`.

- [ ] **Step 1: Add `self_serve` to the INSERT**

In `functions/_lib/events.js`, the `INSERT INTO events` currently lists columns ending `… livestream_url, created_at)` with 20 `?` placeholders and a matching `.bind(...)` ending `… clampStr(body.livestream_url, 400), ts`. Change the column list to add `self_serve` before `created_at`, add one `?`, and bind `body.self_serve ? 1 : 0` before `ts`:
```js
  await db
    .prepare(
      `INSERT INTO events
       (id, slug, owner_email, inquiry_id, title, host_names, event_type, event_date,
        start_time, venue, location, cover_image, story, currency, visibility,
        rsvp_enabled, contributions_enabled, contribution_goal, livestream_url, self_serve, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id, slug, ownerEmail || null, clampStr(body.inquiry_id, 60) || null,
      title, clampStr(body.host_names, 160), clampStr(body.event_type, 40),
      clampStr(body.event_date, 20), clampStr(body.start_time, 20),
      clampStr(body.venue, 160), clampStr(body.location, 160),
      clampStr(body.cover_image, 400), clampStr(body.story, 4000), currency, visibility,
      body.rsvp_enabled === false ? 0 : 1,
      body.contributions_enabled === false ? 0 : 1,
      goal, clampStr(body.livestream_url, 400), body.self_serve ? 1 : 0, ts
    )
    .run()
```
(21 columns, 21 placeholders, 21 bind args. Organizer creates don't pass `self_serve` → defaults to 0.)

- [ ] **Step 2: Verify + commit**

Run: `node --check functions/_lib/events.js` (expect no output), then:
```bash
git add functions/_lib/events.js
git commit -m "feat(events): createEventRecord persists self_serve"
```

---

### Task 3: Harden the legacy client create

**Files:** Modify `functions/api/events/index.js`.

**Context:** `POST /api/events` lets any signed-in client create an event; today it passes the client's body straight through, which would allow a public, contributions-enabled page — bypassing the approval gate. `api.createEvent` has no UI callers. Force safe self-serve values so this endpoint can only produce a pending, unlisted self-serve draft. (Organizers create via `/api/org/events`, unaffected.)

- [ ] **Step 1: Force safe values**

In `functions/api/events/index.js`, change the create call. It currently is:
```js
  const body = await readJson(request)
  try {
    const res = await createEventRecord(db, owner?.email || null, body)
```
to:
```js
  const body = await readJson(request)
  try {
    const res = await createEventRecord(db, owner?.email || null, {
      ...body,
      self_serve: true,
      contributions_enabled: false,
      visibility: 'unlisted',
    })
```

- [ ] **Step 2: Verify + commit**

Run: `node --check functions/api/events/index.js` (expect no output), then:
```bash
git add functions/api/events/index.js
git commit -m "fix(events): client create is always a pending unlisted self-serve draft"
```

---

### Task 4: Public read returns `self_serve`

**Files:** Modify `functions/api/events/[slug].js`.

- [ ] **Step 1: Add `self_serve` to the event SELECT**

In `functions/api/events/[slug].js`, the event query selects `… contributions_enabled, contribution_goal, livestream_url FROM events WHERE slug = ?`. Add `self_serve`:
```js
    .prepare(
      `SELECT id, slug, title, host_names, event_type, event_date, start_time, venue,
              location, cover_image, story, currency, visibility, rsvp_enabled,
              contributions_enabled, contribution_goal, livestream_url, self_serve
       FROM events WHERE slug = ?`
    )
```
(`self_serve` now rides along in the returned `event` object. No other change — `lineItems` already returned.)

- [ ] **Step 2: Verify + commit**

Run: `node --check functions/api/events/[slug].js` (expect no output), then:
```bash
git add functions/api/events/[slug].js
git commit -m "feat(funding): public read returns event.self_serve"
```

---

### Task 5: Client funding endpoint

**Files:** Create `functions/api/portal/funding.js`.

- [ ] **Step 1: Create the endpoint**

Create `functions/api/portal/funding.js`:
```js
// /api/portal/funding — a signed-in client's OWN self-serve funding page.
//   GET                       -> { event, lineItems, canCreate, inquiry }
//   POST { action, ... }      -> create | update | import_lines | line_upsert | line_delete
// Money is never enabled here — a self-serve page stays contributions_enabled=0 until an
// organizer accepts it (functions/api/org/events.js accept_self_serve).

import { ok, fail, readJson } from '../../_lib/respond.js'
import { uid, now, clampStr } from '../../_lib/util.js'
import { currentClientId } from '../../_lib/auth.js'
import { createEventRecord } from '../../_lib/events.js'
import { lineItemsFromQuote, progressPct } from '../../_lib/funding.js'

async function currentClient(request, env) {
  const clientId = await currentClientId(request, env)
  if (!clientId) return null
  return env.DB.prepare('SELECT id, email, name FROM clients WHERE id = ?').bind(clientId).first()
}

// The client's own self-serve event (most recent), or null.
function ownEvent(db, email) {
  return db
    .prepare('SELECT * FROM events WHERE owner_email = ? AND self_serve = 1 ORDER BY created_at DESC LIMIT 1')
    .bind(email)
    .first()
}

// The client's most recent inquiry (the quote source), or null.
function latestInquiry(db, clientId) {
  return db
    .prepare('SELECT id, event_type, event_date, quote_json FROM inquiries WHERE client_id = ? ORDER BY created_at DESC LIMIT 1')
    .bind(clientId)
    .first()
}

async function lineItemsFor(db, eventId) {
  const { results } = await db
    .prepare(
      `SELECT li.id, li.label, li.target_amount, li.visible, li.delivery_status, li.sort,
              COALESCE(SUM(CASE WHEN c.status = 'success' THEN c.amount END), 0) AS raised
       FROM event_line_items li
       LEFT JOIN contributions c ON c.line_item_id = li.id
       WHERE li.event_id = ?
       GROUP BY li.id
       ORDER BY li.sort, li.created_at`
    )
    .bind(eventId)
    .all()
  return results.map((l) => ({
    id: l.id, label: l.label, target: l.target_amount, raised: l.raised,
    pct: progressPct(l.raised, l.target_amount), visible: l.visible, sort: l.sort,
    delivery_status: l.delivery_status,
  }))
}

export async function onRequestGet({ request, env }) {
  const client = await currentClient(request, env)
  if (!client) return fail('Not signed in', 401)
  const db = env.DB

  const inquiry = await latestInquiry(db, client.id)
  const event = await ownEvent(db, client.email)
  if (!event) {
    return ok({
      event: null,
      canCreate: Boolean(inquiry),
      inquiry: inquiry
        ? { id: inquiry.id, event_type: inquiry.event_type, event_date: inquiry.event_date, hasQuote: Boolean(inquiry.quote_json) }
        : null,
    })
  }

  return ok({
    event: { id: event.id, slug: event.slug, title: event.title, host_names: event.host_names, event_date: event.event_date, story: event.story, cover_image: event.cover_image, contributions_enabled: event.contributions_enabled, visibility: event.visibility },
    lineItems: await lineItemsFor(db, event.id),
    inquiry: inquiry ? { id: inquiry.id, hasQuote: Boolean(inquiry.quote_json) } : null,
    canCreate: false,
  })
}

export async function onRequestPost({ request, env }) {
  const client = await currentClient(request, env)
  if (!client) return fail('Not signed in', 401)
  const db = env.DB
  const body = await readJson(request)
  const action = body.action

  if (action === 'create') {
    const existing = await ownEvent(db, client.email)
    if (existing) return fail('You already have a funding page', 409)
    const inquiry = await latestInquiry(db, client.id)
    const res = await createEventRecord(db, client.email, {
      title: body.title,
      host_names: body.host_names,
      event_type: body.event_type,
      event_date: body.event_date,
      cover_image: body.cover_image,
      story: body.story,
      inquiry_id: inquiry?.id || null,
      self_serve: true,
      contributions_enabled: false,
      visibility: 'unlisted',
    })
    return ok(res)
  }

  // All remaining actions operate only on the client's own self-serve event.
  const event = await ownEvent(db, client.email)
  if (!event) return fail('No funding page yet', 404)

  if (action === 'update') {
    await db
      .prepare('UPDATE events SET title = ?, host_names = ?, event_date = ?, cover_image = ?, story = ? WHERE id = ?')
      .bind(clampStr(body.title, 120) || event.title, clampStr(body.host_names, 160), clampStr(body.event_date, 20), clampStr(body.cover_image, 400), clampStr(body.story, 4000), event.id)
      .run()
    return ok({ id: event.id })
  }

  if (action === 'import_lines') {
    const existing = await db.prepare('SELECT COUNT(*) AS n FROM event_line_items WHERE event_id = ?').bind(event.id).first()
    if (existing.n > 0) return fail('You already have funding lines — delete them first, or add manually.', 409)
    const inq = await db.prepare('SELECT quote_json FROM inquiries WHERE id = ?').bind(event.inquiry_id).first()
    const rows = lineItemsFromQuote(inq?.quote_json)
    if (!rows.length) return fail('No saved quote to import', 422)
    const ts = now()
    await db.batch(
      rows.map((r, i) =>
        db.prepare(
          `INSERT INTO event_line_items (id, event_id, label, category_key, target_amount, sort, visible, delivery_status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, 'pending', ?)`
        ).bind(uid('eli_'), event.id, r.label, r.category_key, r.target_amount, i, ts)
      )
    )
    return ok({ imported: rows.length })
  }

  if (action === 'line_upsert') {
    const label = clampStr(body.label, 120)
    if (!label) return fail('A label is required', 422)
    const target = Math.max(0, Math.round(Number(body.target_amount) || 0))
    const sort = parseInt(body.sort) || 0
    const visible = body.visible === false ? 0 : 1
    if (body.id) {
      const id = clampStr(body.id, 60)
      if (!id) return fail('id is required', 422)
      const ex = await db.prepare('SELECT id FROM event_line_items WHERE id = ? AND event_id = ?').bind(id, event.id).first()
      if (!ex) return fail('Line not found', 404)
      await db.prepare('UPDATE event_line_items SET label = ?, target_amount = ?, sort = ?, visible = ? WHERE id = ?')
        .bind(label, target, sort, visible, id).run()
      return ok({ id })
    }
    const id = uid('eli_')
    await db.prepare(
      `INSERT INTO event_line_items (id, event_id, label, category_key, target_amount, sort, visible, delivery_status, created_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?, 'pending', ?)`
    ).bind(id, event.id, label, target, sort, visible, now()).run()
    return ok({ id })
  }

  if (action === 'line_delete') {
    const id = clampStr(body.id, 60)
    if (!id) return fail('id is required', 422)
    const ex = await db.prepare('SELECT id FROM event_line_items WHERE id = ? AND event_id = ?').bind(id, event.id).first()
    if (!ex) return fail('Line not found', 404)
    await db.batch([
      db.prepare('UPDATE contributions SET line_item_id = NULL WHERE line_item_id = ?').bind(id),
      db.prepare('DELETE FROM event_line_items WHERE id = ?').bind(id),
    ])
    return ok({ deleted: true })
  }

  return fail('Unknown action', 422)
}
```

- [ ] **Step 2: Verify + commit**

Run: `node --check functions/api/portal/funding.js` (expect no output), then:
```bash
git add functions/api/portal/funding.js
git commit -m "feat(portal): client-owned self-serve funding endpoint"
```

---

### Task 6: Organizer accept + queue columns

**Files:** Modify `functions/api/org/events.js`.

- [ ] **Step 1: Return `self_serve` + `contributions_enabled` in the events list**

In `functions/api/org/events.js`, the default GET list query is:
```js
      `SELECT id, slug, title, host_names, event_type, event_date, visibility, inquiry_id, created_at
       FROM events ORDER BY created_at DESC LIMIT 200`
```
Change it to add the two columns:
```js
      `SELECT id, slug, title, host_names, event_type, event_date, visibility, inquiry_id,
              self_serve, contributions_enabled, created_at
       FROM events ORDER BY created_at DESC LIMIT 200`
```

- [ ] **Step 2: Add the `accept_self_serve` action**

In the same file's `onRequestPost`, immediately BEFORE the final `return fail('Unknown action', 422)`, add:
```js
  if (action === 'accept_self_serve') {
    const id = clampStr(body.id, 60)
    if (!id) return fail('id is required', 422)
    const ev = await db.prepare('SELECT id, slug, title FROM events WHERE id = ?').bind(id).first()
    if (!ev) return fail('Event not found', 404)
    await db.prepare('UPDATE events SET contributions_enabled = 1 WHERE id = ?').bind(id).run()
    await logActivity(db, {
      actor: org.email, action: 'funding.accept', entityType: 'event', entityId: id,
      detail: `Enabled funding on "${ev.title}" (/e/${ev.slug})`,
    })
    return ok({ id, contributions_enabled: 1 })
  }
```

- [ ] **Step 3: Verify + commit**

Run: `node --check functions/api/org/events.js` (expect no output), then:
```bash
git add functions/api/org/events.js
git commit -m "feat(org): accept_self_serve enables funding + list flags pending pages"
```

---

### Task 7: API client methods

**Files:** Modify `src/lib/api.js`.

- [ ] **Step 1: Add the two methods**

In `src/lib/api.js`, immediately after the line `portal: () => request('/portal/me'),`, add:
```js
  portalFunding: () => request('/portal/funding'),
  portalFundingAction: (payload) => request('/portal/funding', { method: 'POST', body: payload }),
```

- [ ] **Step 2: Verify + commit**

Run: `node --check src/lib/api.js` (expect no output), then:
```bash
git add src/lib/api.js
git commit -m "feat(api): portalFunding + portalFundingAction"
```

---

### Task 8: EventPage preview state

**Files:** Modify `src/pages/EventPage.jsx`.

- [ ] **Step 1: Add the read-only funding preview**

In `src/pages/EventPage.jsx`, find the contribution pool block (it renders `{event.contributions_enabled && ( <Section tone="cream" id="gift"> … <ContributionPool … /> … </Section> )}`). Immediately AFTER that closing `)}`, add a preview block for pending self-serve pages:
```jsx
      {/* Self-serve funding preview — money not enabled until the studio accepts */}
      {!event.contributions_enabled && event.self_serve === 1 && lineItems.length > 0 && (
        <Section tone="cream" id="gift">
          <Container className="max-w-2xl">
            <div className="text-center mb-8">
              <Eyebrow className="text-terracotta mb-3">A gift from the heart</Eyebrow>
              <h2 className="font-display text-plum text-3xl sm:text-4xl text-balance">Help {event.host_names || 'the hosts'} celebrate</h2>
              <p className="mt-4 text-ink/65">Funding opens once the studio confirms this event.</p>
            </div>
            <ul className="space-y-3">
              {lineItems.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 rounded-2xl bg-cream-deep border border-plum/8 p-4">
                  <span className="font-display text-plum">{l.label}</span>
                  {l.target > 0 && <span className="tnum text-ink/60 text-sm">{formatMoney(l.target, event.currency)}</span>}
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      )}
```
(`Eyebrow`, `formatMoney`, `Section`, `Container` are already imported in this file.)

- [ ] **Step 2: Build + commit**

Run: `npm run build` (expect exit 0), then:
```bash
git add src/pages/EventPage.jsx
git commit -m "feat(funding): read-only funding preview on pending self-serve pages"
```

---

### Task 9: OrgEvents pending badge + Accept button

**Files:** Modify `src/pages/OrgEvents.jsx`.

- [ ] **Step 1: Add an accept handler**

In `src/pages/OrgEvents.jsx`, inside `OrgEvents`, right after the existing `const remove = async (ev) => { … }` handler, add:
```jsx
  const accept = async (ev) => { try { await api.orgEventAction({ action: 'accept_self_serve', id: ev.id }); await load() } catch { /* noop */ } }
```

- [ ] **Step 2: Add the badge + button to the event row header**

In the event row, the header row currently is:
```jsx
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-plum">{e.host_names || e.title}</p>
                    <p className="text-ink/50 text-xs">{e.event_type || 'Event'} · {fmtDate(e.event_date)} · {e.visibility}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <a href={`/e/${e.slug}`} target="_blank" rel="noopener noreferrer" className="text-terracotta text-sm inline-flex items-center gap-1 link-underline">View <ArrowRight size={14} /></a>
                    <button onClick={() => remove(e)} disabled={!canWrite} className="text-xs rounded-full border border-terracotta/30 px-3 py-1.5 text-terracotta disabled:opacity-50">Delete</button>
                  </div>
                </div>
```
Replace it with (adds a "Pending funding" chip next to the name and an "Accept & enable funding" button for pending self-serve pages):
```jsx
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-plum">
                      {e.host_names || e.title}
                      {e.self_serve === 1 && e.contributions_enabled === 0 && (
                        <span className="ml-2 align-middle text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-champagne/25 text-terracotta">Pending funding</span>
                      )}
                    </p>
                    <p className="text-ink/50 text-xs">{e.event_type || 'Event'} · {fmtDate(e.event_date)} · {e.visibility}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {canWrite && e.self_serve === 1 && e.contributions_enabled === 0 && (
                      <button onClick={() => accept(e)} className="text-xs rounded-full bg-plum text-cream px-3 py-1.5 hover:bg-plum-soft transition-colors">Accept &amp; enable funding</button>
                    )}
                    <a href={`/e/${e.slug}`} target="_blank" rel="noopener noreferrer" className="text-terracotta text-sm inline-flex items-center gap-1 link-underline">View <ArrowRight size={14} /></a>
                    <button onClick={() => remove(e)} disabled={!canWrite} className="text-xs rounded-full border border-terracotta/30 px-3 py-1.5 text-terracotta disabled:opacity-50">Delete</button>
                  </div>
                </div>
```

- [ ] **Step 3: Build + commit**

Run: `npm run build` (expect exit 0), then:
```bash
git add src/pages/OrgEvents.jsx
git commit -m "feat(org): accept self-serve funding pages from the events list"
```

---

### Task 10: Portal "Your funding page" section

**Files:** Modify `src/pages/Portal.jsx`.

- [ ] **Step 1: Add imports**

In `src/pages/Portal.jsx`, add a `Field` import and extend the money import. Add near the other imports:
```jsx
import Field from '../components/ui/Field.jsx'
```
And change `import { formatMoney } from '../lib/money.js'` to:
```jsx
import { formatMoney, fromMinor, toMinor } from '../lib/money.js'
```

- [ ] **Step 2: Add the `PortalFunding` component**

Above `export default function Portal() {`, add:
```jsx
function PortalFunding() {
  const [data, setData] = useState(null)
  const [creating, setCreating] = useState({ title: '', host_names: '' })
  const [draft, setDraft] = useState({ label: '', goal: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setData(await api.portalFunding()) } catch { setData({ event: null, canCreate: false }) }
  }, [])
  useEffect(() => { load() }, [load])

  const act = async (payload) => { setBusy(true); try { await api.portalFundingAction(payload); await load() } catch { /* noop */ } finally { setBusy(false) } }

  if (data === null) return null

  if (!data.event) {
    if (!data.canCreate) return null
    return (
      <div className="rounded-3xl bg-cream-deep border border-plum/8 p-8">
        <h2 className="font-display text-plum text-2xl mb-1">Your funding page</h2>
        <p className="text-ink/55 text-sm mb-5">Turn your quote into a page loved ones can contribute to. You share it; we enable giving once your event is confirmed.</p>
        <div className="flex flex-wrap items-end gap-3">
          <Field className="flex-1 min-w-[160px]" label="Page title" value={creating.title} onChange={(e) => setCreating({ ...creating, title: e.target.value })} placeholder="Ama & Kojo's Wedding" />
          <Field label="Host names" value={creating.host_names} onChange={(e) => setCreating({ ...creating, host_names: e.target.value })} placeholder="Ama & Kojo" />
          <Button
            onClick={() => act({ action: 'create', title: creating.title || `${creating.host_names || 'Our'} celebration`, host_names: creating.host_names, event_type: data.inquiry?.event_type, event_date: data.inquiry?.event_date })}
            variant="primary" size="sm" loading={busy}
          >Create page</Button>
        </div>
      </div>
    )
  }

  const ev = data.event
  const live = ev.contributions_enabled === 1
  const lines = data.lineItems || []
  const addLine = async () => {
    if (!draft.label.trim()) return
    await act({ action: 'line_upsert', label: draft.label, target_amount: toMinor(parseFloat(draft.goal) || 0, 'GHS'), sort: lines.length })
    setDraft({ label: '', goal: '' })
  }

  return (
    <div className="rounded-3xl bg-cream-deep border border-plum/8 p-8 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-plum text-2xl">Your funding page</h2>
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${live ? 'bg-kente/15 text-kente' : 'bg-champagne/20 text-terracotta'}`}>{live ? 'Live' : 'Pending studio approval'}</span>
      </div>
      <a href={`/e/${ev.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-terracotta link-underline">Share your page · /e/{ev.slug} <ArrowRight size={14} /></a>

      <div className="pt-3 border-t border-plum/10 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-ink/45">Funding lines</p>
          {data.inquiry?.hasQuote && lines.length === 0 && (
            <button type="button" onClick={() => act({ action: 'import_lines' })} disabled={busy} className="text-xs rounded-full bg-plum text-cream px-3 py-1.5 disabled:opacity-50">Import my quote</button>
          )}
        </div>
        {lines.length === 0 ? <p className="text-ink/45 text-xs">No lines yet — import your quote or add one below.</p> : (
          <ul className="space-y-2">
            {lines.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="flex-1 min-w-[120px] text-ink/80">{l.label} {l.visible ? '' : <span className="text-ink/40 text-xs">(hidden)</span>}</span>
                <span className="tnum text-plum">{fromMinor(l.target, 'GHS')} GH₵</span>
                <button type="button" onClick={() => act({ action: 'line_upsert', id: l.id, label: l.label, target_amount: l.target, sort: l.sort, visible: l.visible ? false : true })} className="text-xs text-ink/50 link-underline">{l.visible ? 'Hide' : 'Show'}</button>
                <button type="button" onClick={() => act({ action: 'line_delete', id: l.id })} className="text-xs text-terracotta link-underline">Delete</button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-2 pt-1">
          <Field className="flex-1 min-w-[140px]" label="New line" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Catering" />
          <Field label="Target (GH₵)" type="number" value={draft.goal} onChange={(e) => setDraft({ ...draft, goal: e.target.value })} />
          <Button onClick={addLine} variant="outline" size="sm" loading={busy}>Add</Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Render it in the portal**

In `Portal.jsx`, find the "Planning timeline" card:
```jsx
                <div className="rounded-3xl bg-cream-deep border border-plum/8 p-8">
                  <h2 className="font-display text-plum text-2xl mb-6">Planning timeline</h2>
                  <Timeline items={data.timeline} onAction={actOnMilestone} acting={acting} />
                </div>
```
Immediately BEFORE that card, add:
```jsx
                <PortalFunding />
```

- [ ] **Step 4: Build + commit**

Run: `npm run build` (expect exit 0), then:
```bash
git add src/pages/Portal.jsx
git commit -m "feat(portal): couple self-serve funding page section"
```

---

### Task 11: Migrate live D1, deploy, verify

**Files:** none (operational). Requires the correct wrangler login (**ghwmelite@gmail.com / acct ea2eb3a9…**).

- [ ] **Step 1: Tests + build**

Run: `node scripts/test-funding.mjs && npm run build`
Expected: `OK: funding helper assertions passed`, then a clean build.

- [ ] **Step 2: Migrate the live D1 (one-off)**

Run:
```bash
npx wrangler d1 execute gather-ghana --remote --yes --file=./migrations/add-event-self-serve.sql
```
Expected: success. (One-off — the `ALTER` errors if re-run; that's fine.)

- [ ] **Step 3: Deploy to production**

Run: `npx wrangler pages deploy dist --project-name gather-ghana-events --branch main --commit-dirty=true`
Expected: "Deployment complete".

- [ ] **Step 4: Manual verification on production**

Use a signed-in **client** session (mint one per the prod-verification playbook for a client that has an inquiry with a `quote_json` — e.g. seed a client + inquiry with quote_json, then verify a magic token) and a **viewer/organizer** session.

1. **Client, no page:** `GET /api/portal/funding` returns `{ event: null, canCreate: true, inquiry: { hasQuote: true } }`.
2. **Client create:** `POST /api/portal/funding {action:'create', title, host_names}` → returns `{ id, slug }`. `GET` now returns the event with `contributions_enabled: 0`.
3. **Client import:** `POST {action:'import_lines'}` → `imported > 0`; `GET` shows the lines.
4. **Public preview:** open `/e/<slug>` — the funding lines show as a read-only **preview** with "Funding opens once the studio confirms this event", and there is **no gift form**. Confirm `<meta name="robots" content="noindex">` (unlisted).
5. **Organizer accept:** on `/org/events`, the page shows a **Pending funding** chip + **Accept & enable funding**. Click it (or `POST /api/org/events {action:'accept_self_serve', id}`). `/e/<slug>` now shows the normal gift flow + line picker.
6. **Guardrail:** as a signed-in client, `POST /api/portal/funding {action:'create'}` a second time → 409; editing a line you don't own (another event's line id) → 404.

- [ ] **Step 5: Clean up + finish the branch**

Delete any seeded test client/inquiry/event/line rows created for verification. Then use `superpowers:finishing-a-development-branch` to merge `feat/self-serve-funding` to `main` (and push).

---

## Self-Review Notes

- **Spec coverage:** `events.self_serve` column → Task 1; `createEventRecord` self_serve → Task 2; legacy-endpoint hardening → Task 3; public read `self_serve` → Task 4; client create/update/import/line CRUD (ownership-guarded, money never enabled) → Task 5; organizer `accept_self_serve` + pending-queue columns → Task 6; client api methods → Task 7; public preview state → Task 8; organizer badge + accept button → Task 9; portal "Your funding page" section → Task 10; migrate/deploy/verify → Task 11. Money model stays Option A: self-serve create forces `contributions_enabled=0`; only `accept_self_serve` (currentEditor) enables it; the contribute rail is unchanged.
- **Name consistency:** the client GET shape `{ event, lineItems:[{id,label,target,raised,pct,visible,sort,delivery_status}], canCreate, inquiry:{id,hasQuote,event_type?,event_date?} }` (Task 5) is consumed by `PortalFunding` (Task 10); the create action returns `{id,slug}`; `accept_self_serve`/`self_serve`/`contributions_enabled` names match between Task 6 (endpoint), Task 9 (OrgEvents), and Task 8 (EventPage preview guard `event.self_serve === 1`); `portalFunding`/`portalFundingAction` defined in Task 7 and used in Task 10; `line_upsert`/`line_delete`/`import_lines`/`update`/`create` action strings match between Task 5 and Task 10.
- **Ownership/security:** every client management action resolves the client's OWN event via `ownEvent(db, client.email)` and scopes line lookups by `event_id = event.id` (Task 5), so a client can't touch another couple's or an organizer's page; the legacy create hole is closed (Task 3); money is only enabled by an organizer (Task 6).
- **Honesty guard:** no "escrow/held/protected" copy; the preview says "Funding opens once the studio confirms this event."
- **Backward compatibility:** `self_serve` defaults 0; organizer-built pages are unaffected (Task 2 default, Task 9 conditionals only fire for `self_serve===1 && contributions_enabled===0`); `noindex` for unlisted already exists in EventPage.
- **YAGNI:** no couple Paystack subaccounts, no schedule/gallery/RSVP editing, no client delivery-status, one page per couple.
