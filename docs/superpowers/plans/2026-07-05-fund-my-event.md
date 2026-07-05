# Fund-my-Event (Line-Itemized Event Funding) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish an Instant Quote's breakdown onto a couple's public event page as individually fundable line items ("Catering — GH₵4,000, 60% funded"), so guests can contribute to specific parts.

**Architecture:** Additive on the existing Pages Functions + D1 + Paystack stack. New `event_line_items` table + a `contributions.line_item_id` tag + a saved `inquiries.quote_json`. Contributions stay real Paystack payments to the single merchant account (Option A — no custody); the organizer publishes lines and marks delivery. New business logic is isolated in a pure, unit-tested `functions/_lib/funding.js`. Reuses the event page, contribute flow, and reconciliation unchanged.

**Tech Stack:** Cloudflare Pages Functions, D1 (SQLite), Paystack, React + Vite SPA, Tailwind. Pure logic tested via `node`; endpoints via `node --check` + manual API checks; UI via `npm run build` + smoke test.

**Spec:** `docs/superpowers/specs/2026-07-05-fund-my-event-design.md`

**Branch:** Create `feat/fund-my-event` off `main` before Task 1.

---

## File Structure

- `schema.sql` (modify) + `migrations/add-event-funding.sql` (create) — table + column adds.
- `functions/_lib/funding.js` (create) + `scripts/test-funding.mjs` (create) — pure helpers + test.
- `functions/api/inquiries.js` (modify) — persist `quote_json`.
- `src/pages/Concierge.jsx` (modify) — pass the quote on hand-off.
- `functions/api/events/[slug].js` (modify) — return visible line items + progress.
- `functions/api/events/[slug]/contribute.js` (modify) — accept + validate + store `lineItemId`.
- `functions/api/org/events.js` (modify) — lines/quotes reads + line management actions.
- `src/lib/api.js` (modify) — client methods for lines + quotes.
- `src/pages/OrgEvents.jsx` (modify) — per-event "Funding lines" panel.
- `src/pages/EventPage.jsx` (modify) — line-item funding list + direct-a-gift selector.

---

### Task 1: Schema + migration

**Files:**
- Modify: `schema.sql`
- Create: `migrations/add-event-funding.sql`

- [ ] **Step 1: Add the table + columns to `schema.sql`**

Append to the end of `schema.sql`:
```sql

-- Line-itemized event funding (Fund-my-Event). Each row is a fundable target on an event page.
CREATE TABLE IF NOT EXISTS event_line_items (
  id              TEXT PRIMARY KEY,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  category_key    TEXT,
  target_amount   INTEGER NOT NULL DEFAULT 0,      -- minor units (pesewas), event currency
  sort            INTEGER NOT NULL DEFAULT 0,
  visible         INTEGER NOT NULL DEFAULT 1,
  delivery_status TEXT NOT NULL DEFAULT 'pending', -- pending | booked | delivered
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_line_items_event ON event_line_items(event_id, visible, sort);
```

In `schema.sql`, add `line_item_id TEXT` to the `contributions` table definition (after the `reference` line, before `created_at`) so fresh databases include it:
```sql
  reference   TEXT NOT NULL UNIQUE,
  line_item_id TEXT,                              -- NULL = general pool
  created_at  INTEGER NOT NULL
```

And add `quote_json TEXT` to the `inquiries` table definition (after the `notes` line):
```sql
  notes       TEXT,
  quote_json  TEXT,                               -- JSON snapshot of the Instant Quote breakdown
  status      TEXT NOT NULL DEFAULT 'new',  -- new | quoted | booked | completed | cancelled
```

- [ ] **Step 2: Create the one-off migration**

Create `migrations/add-event-funding.sql`:
```sql
-- Fund-my-Event: fundable line items + per-contribution line tag + saved quote.
-- ONE-OFF (ALTERs are NOT re-runnable in SQLite — run once on live D1):
--   npx wrangler d1 execute gather-ghana --remote --yes --file=./migrations/add-event-funding.sql

CREATE TABLE IF NOT EXISTS event_line_items (
  id              TEXT PRIMARY KEY,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  category_key    TEXT,
  target_amount   INTEGER NOT NULL DEFAULT 0,
  sort            INTEGER NOT NULL DEFAULT 0,
  visible         INTEGER NOT NULL DEFAULT 1,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_line_items_event ON event_line_items(event_id, visible, sort);

ALTER TABLE contributions ADD COLUMN line_item_id TEXT;
ALTER TABLE inquiries ADD COLUMN quote_json TEXT;
```

- [ ] **Step 3: Commit**

```bash
git add schema.sql migrations/add-event-funding.sql
git commit -m "feat(schema): event_line_items + contributions.line_item_id + inquiries.quote_json"
```

---

### Task 2: `funding.js` pure helpers (+ test)

**Files:**
- Create: `functions/_lib/funding.js`
- Create: `scripts/test-funding.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-funding.mjs`:
```js
// Run: node scripts/test-funding.mjs
import assert from 'node:assert/strict'
import { lineItemsFromQuote, progressPct } from '../functions/_lib/funding.js'

// --- lineItemsFromQuote ---
assert.deepEqual(lineItemsFromQuote('not json'), [])
assert.deepEqual(lineItemsFromQuote('{"a":1}'), [])   // object, not array
assert.deepEqual(lineItemsFromQuote([]), [])
const items = lineItemsFromQuote(JSON.stringify([
  { label: 'Venue & catering', amount: 4000 },
  { label: '   ', amount: 100 },               // blank label → dropped
  { label: 'Décor', amount: 2000, key: 'decor' },
]))
assert.equal(items.length, 2)
assert.deepEqual(items[0], { label: 'Venue & catering', category_key: null, target_amount: 400000 })
assert.equal(items[1].category_key, 'decor')
assert.equal(items[1].target_amount, 200000)   // whole cedis → pesewas

// --- progressPct ---
assert.equal(progressPct(0, 0), null)          // no target
assert.equal(progressPct(100, 0), null)
assert.equal(progressPct(50000, 100000), 50)
assert.equal(progressPct(150000, 100000), 100) // capped at 100
assert.equal(progressPct(0, 100000), 0)

console.log('OK: funding helper assertions passed')
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/test-funding.mjs`
Expected: FAIL — cannot find module `../functions/_lib/funding.js`.

- [ ] **Step 3: Implement the helper**

Create `functions/_lib/funding.js`:
```js
// Pure helpers for line-itemized event funding (Fund-my-Event). No I/O — unit-tested.

/**
 * Map a saved Instant Quote breakdown to funding-line rows.
 * Quote items look like { label, amount(, key) } where `amount` is WHOLE cedis.
 * Returns [{ label, category_key, target_amount }] with target_amount in MINOR units.
 * Returns [] for bad/empty input.
 */
export function lineItemsFromQuote(quoteJson) {
  let arr = quoteJson
  if (typeof quoteJson === 'string') {
    try { arr = JSON.parse(quoteJson) } catch { return [] }
  }
  if (!Array.isArray(arr)) return []
  return arr
    .filter((it) => it && typeof it.label === 'string' && it.label.trim())
    .map((it) => ({
      label: it.label.trim().slice(0, 120),
      category_key: typeof it.key === 'string' ? it.key.slice(0, 40) : null,
      target_amount: Math.max(0, Math.round(Number(it.amount) || 0)) * 100,
    }))
}

/** Progress percent (0..100) of `raised` toward `target`, or null when there is no target. */
export function progressPct(raised, target) {
  if (!target || target <= 0) return null
  return Math.min(100, Math.round(((Number(raised) || 0) / target) * 100))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-funding.mjs`
Expected: PASS — `OK: funding helper assertions passed`

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/funding.js scripts/test-funding.mjs
git commit -m "feat(funding): quote→line-items + progress helpers (tested)"
```

---

### Task 3: Persist the quote on hand-off

**Files:**
- Modify: `functions/api/inquiries.js`
- Modify: `src/pages/Concierge.jsx`

- [ ] **Step 1: Accept + store `quote_json` in the inquiry**

In `functions/api/inquiries.js`, after the `const notes = clampStr(body.notes, 2000)` line, add:
```js
  const quoteJson = typeof body.quoteJson === 'string' ? body.quoteJson.slice(0, 8000) : null
```

Then change the inquiry INSERT (currently columns `... deposit, notes, status ...`) to include `quote_json`:
```js
  await db
    .prepare(
      `INSERT INTO inquiries
       (id, client_id, event_type, event_date, guests, estimate, deposit, notes, quote_json, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`
    )
    .bind(inquiryId, clientId, type, date, guests, estimate, deposit, notes, quoteJson, ts)
    .run()
```

- [ ] **Step 2: Pass the quote from the concierge hand-off**

In `src/pages/Concierge.jsx`, the hand-off currently calls (around line 50):
```js
      await api.createInquiry({ type: plan.type, guests: plan.guests, estimate: plan.budget, deposit: 0, name: lead.name, email: lead.email, phone: lead.phone, notes })
```
Change it to also send the breakdown as `quoteJson`:
```js
      const quoteJson = JSON.stringify((plan.budgetSplit || []).map((b) => ({ label: b.label, amount: b.amount })))
      await api.createInquiry({ type: plan.type, guests: plan.guests, estimate: plan.budget, deposit: 0, name: lead.name, email: lead.email, phone: lead.phone, notes, quoteJson })
```

- [ ] **Step 3: Verify + commit**

Run: `node --check functions/api/inquiries.js` (expect no output) and `npm run build` (expect exit 0), then:
```bash
git add functions/api/inquiries.js src/pages/Concierge.jsx
git commit -m "feat(funding): persist the Instant Quote breakdown on the lead"
```

---

### Task 4: Public read returns line items + progress

**Files:**
- Modify: `functions/api/events/[slug].js`

- [ ] **Step 1: Fetch visible lines with their raised totals and attach progress**

Replace the entire contents of `functions/api/events/[slug].js` with:
```js
// GET /api/events/:slug — public event page data (respects visibility).

import { json, fail } from '../../_lib/respond.js'
import { progressPct } from '../../_lib/funding.js'

export async function onRequestGet({ params, env }) {
  const slug = params.slug
  const db = env.DB

  const event = await db
    .prepare(
      `SELECT id, slug, title, host_names, event_type, event_date, start_time, venue,
              location, cover_image, story, currency, visibility, rsvp_enabled,
              contributions_enabled, contribution_goal, livestream_url
       FROM events WHERE slug = ?`
    )
    .bind(slug)
    .first()

  if (!event || event.visibility === 'private') return fail('Event not found', 404)

  const [schedule, gallery, rsvpAgg, contribAgg, recent, lines] = await Promise.all([
    db.prepare('SELECT time, title, description FROM event_schedule WHERE event_id = ? ORDER BY sort, time')
      .bind(event.id).all(),
    db.prepare('SELECT url, caption FROM event_gallery WHERE event_id = ? ORDER BY sort')
      .bind(event.id).all(),
    db.prepare("SELECT COALESCE(SUM(party_size),0) AS guests, COUNT(*) AS replies FROM rsvps WHERE event_id = ? AND status = 'yes'")
      .bind(event.id).first(),
    db.prepare("SELECT COALESCE(SUM(amount),0) AS raised, COUNT(*) AS gifts FROM contributions WHERE event_id = ? AND status = 'success'")
      .bind(event.id).first(),
    db.prepare("SELECT CASE WHEN anonymous = 1 THEN NULL ELSE name END AS name, amount, currency, message FROM contributions WHERE event_id = ? AND status = 'success' ORDER BY created_at DESC LIMIT 12")
      .bind(event.id).all(),
    db.prepare(
      `SELECT li.id, li.label, li.target_amount, li.delivery_status, li.sort,
              COALESCE(SUM(CASE WHEN c.status = 'success' THEN c.amount END), 0) AS raised
       FROM event_line_items li
       LEFT JOIN contributions c ON c.line_item_id = li.id
       WHERE li.event_id = ? AND li.visible = 1
       GROUP BY li.id
       ORDER BY li.sort, li.created_at`
    ).bind(event.id).all(),
  ])

  const lineItems = lines.results.map((l) => ({
    id: l.id,
    label: l.label,
    target: l.target_amount,
    raised: l.raised,
    pct: progressPct(l.raised, l.target_amount),
    delivery_status: l.delivery_status,
  }))

  return json({
    ok: true,
    event,
    schedule: schedule.results,
    gallery: gallery.results,
    rsvp: { guests: rsvpAgg.guests, replies: rsvpAgg.replies },
    contributions: {
      raised: contribAgg.raised,
      gifts: contribAgg.gifts,
      goal: event.contribution_goal,
      recent: recent.results,
    },
    lineItems,
  })
}
```

- [ ] **Step 2: Verify + commit**

Run: `node --check functions/api/events/[slug].js` (expect no output), then:
```bash
git add functions/api/events/[slug].js
git commit -m "feat(funding): public event read returns fundable line items + progress"
```

---

### Task 5: Contribute accepts a `lineItemId`

**Files:**
- Modify: `functions/api/events/[slug]/contribute.js`

- [ ] **Step 1: Validate the line belongs to the event and store it**

In `functions/api/events/[slug]/contribute.js`, after the block that reads `anonymous` and before the validation (`if (!isEmail(email)) ...`), add line resolution:
```js
  // Optional: direct this gift to a specific, visible line item on THIS event.
  let lineItemId = null
  if (body.lineItemId) {
    const li = await db
      .prepare('SELECT id FROM event_line_items WHERE id = ? AND event_id = ? AND visible = 1')
      .bind(clampStr(body.lineItemId, 60), event.id)
      .first()
    if (!li) return fail('That funding item is not available', 422)
    lineItemId = li.id
  }
```

Then change the `contributions` INSERT to include `line_item_id`:
```js
  await db
    .prepare(
      `INSERT INTO contributions
       (id, event_id, name, email, amount, currency, message, anonymous, status, reference, line_item_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
    )
    .bind(
      uid('con_'), event.id, name, email, amount, event.currency,
      clampStr(body.message, 500), anonymous, reference, lineItemId, now()
    )
    .run()
```

(Reconciliation is unchanged — `reconcile.js` flips the row's `status` to `success` by `reference`, and the `line_item_id` already rides on the row.)

- [ ] **Step 2: Verify + commit**

Run: `node --check functions/api/events/[slug]/contribute.js` (expect no output), then:
```bash
git add functions/api/events/[slug]/contribute.js
git commit -m "feat(funding): contributions can target a line item"
```

---

### Task 6: Organizer API — read lines/quotes + manage lines

**Files:**
- Modify: `functions/api/org/events.js`

- [ ] **Step 1: Replace the endpoint with the line-aware version**

Replace the entire contents of `functions/api/org/events.js` with:
```js
// /api/org/events — admin event pages + funding line items.
//   GET                         -> { events }
//   GET ?eventId=<id>           -> { lines }        (all lines for an event, incl. hidden)
//   GET ?quotes=1               -> { quotes }       (recent leads that have a saved quote)
//   POST { action, ... }        -> create | delete | import_lines | line_upsert | line_delete | line_delivery

import { ok, fail, readJson } from '../../_lib/respond.js'
import { uid, now, clampStr } from '../../_lib/util.js'
import { currentOrganizer, currentEditor } from '../../_lib/auth.js'
import { createEventRecord } from '../../_lib/events.js'
import { lineItemsFromQuote } from '../../_lib/funding.js'
import { logActivity } from '../../_lib/activity.js'

const DELIVERY = ['pending', 'booked', 'delivered']

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const db = env.DB
  const url = new URL(request.url)

  const eventId = url.searchParams.get('eventId')
  if (eventId) {
    const { results } = await db
      .prepare(
        `SELECT id, label, target_amount, sort, visible, delivery_status
         FROM event_line_items WHERE event_id = ? ORDER BY sort, created_at`
      )
      .bind(clampStr(eventId, 60))
      .all()
    return ok({ lines: results })
  }

  if (url.searchParams.get('quotes')) {
    const { results } = await db
      .prepare(
        `SELECT i.id AS inquiryId, i.event_type, c.name
         FROM inquiries i JOIN clients c ON c.id = i.client_id
         WHERE i.quote_json IS NOT NULL AND i.quote_json != ''
         ORDER BY i.created_at DESC LIMIT 50`
      )
      .all()
    const quotes = results.map((r) => ({ inquiryId: r.inquiryId, label: `${r.name} · ${r.event_type}` }))
    return ok({ quotes })
  }

  const { results } = await db
    .prepare(
      `SELECT id, slug, title, host_names, event_type, event_date, visibility, inquiry_id, created_at
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
      db.prepare('DELETE FROM event_line_items WHERE event_id = ?').bind(id),
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

  if (action === 'import_lines') {
    const eventId = clampStr(body.eventId, 60)
    const event = await db.prepare('SELECT id FROM events WHERE id = ?').bind(eventId).first()
    if (!event) return fail('Event not found', 404)
    const inquiryId = clampStr(body.inquiryId, 60)
    const inq = await db.prepare('SELECT quote_json FROM inquiries WHERE id = ?').bind(inquiryId).first()
    const rows = lineItemsFromQuote(inq?.quote_json)
    if (!rows.length) return fail('That lead has no saved quote to import', 422)
    const ts = now()
    await db.batch(
      rows.map((r, i) =>
        db.prepare(
          `INSERT INTO event_line_items (id, event_id, label, category_key, target_amount, sort, visible, delivery_status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, 'pending', ?)`
        ).bind(uid('eli_'), eventId, r.label, r.category_key, r.target_amount, i, ts)
      )
    )
    await logActivity(db, {
      actor: org.email, action: 'funding.import', entityType: 'event', entityId: eventId,
      detail: `Imported ${rows.length} funding lines from a quote`,
    })
    return ok({ imported: rows.length })
  }

  if (action === 'line_upsert') {
    const eventId = clampStr(body.eventId, 60)
    const label = clampStr(body.label, 120)
    if (!label) return fail('A label is required', 422)
    const target = Math.max(0, Math.round(Number(body.target_amount) || 0))
    const sort = parseInt(body.sort) || 0
    const visible = body.visible === false ? 0 : 1
    if (body.id) {
      const id = clampStr(body.id, 60)
      const ex = await db.prepare('SELECT id FROM event_line_items WHERE id = ?').bind(id).first()
      if (!ex) return fail('Line not found', 404)
      await db.prepare('UPDATE event_line_items SET label = ?, target_amount = ?, sort = ?, visible = ? WHERE id = ?')
        .bind(label, target, sort, visible, id).run()
      return ok({ id })
    }
    const event = await db.prepare('SELECT id FROM events WHERE id = ?').bind(eventId).first()
    if (!event) return fail('Event not found', 404)
    const id = uid('eli_')
    await db.prepare(
      `INSERT INTO event_line_items (id, event_id, label, category_key, target_amount, sort, visible, delivery_status, created_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?, 'pending', ?)`
    ).bind(id, eventId, label, target, sort, visible, now()).run()
    return ok({ id })
  }

  if (action === 'line_delete') {
    const id = clampStr(body.id, 60)
    await db.prepare('DELETE FROM event_line_items WHERE id = ?').bind(id).run()
    return ok({ deleted: true })
  }

  if (action === 'line_delivery') {
    const id = clampStr(body.id, 60)
    const status = DELIVERY.includes(body.delivery_status) ? body.delivery_status : null
    if (!status) return fail('Invalid delivery status', 422)
    const ex = await db.prepare('SELECT event_id FROM event_line_items WHERE id = ?').bind(id).first()
    if (!ex) return fail('Line not found', 404)
    await db.prepare('UPDATE event_line_items SET delivery_status = ? WHERE id = ?').bind(status, id).run()
    await logActivity(db, {
      actor: org.email, action: 'funding.delivery', entityType: 'event', entityId: ex.event_id,
      detail: `Funding line marked ${status}`,
    })
    return ok({ id, delivery_status: status })
  }

  return fail('Unknown action', 422)
}
```

- [ ] **Step 2: Verify + commit**

Run: `node --check functions/api/org/events.js` (expect no output), then:
```bash
git add functions/api/org/events.js
git commit -m "feat(org): funding line read + import/upsert/delete/delivery actions"
```

---

### Task 7: API client methods

**Files:**
- Modify: `src/lib/api.js`

- [ ] **Step 1: Add the read helpers**

In `src/lib/api.js`, immediately after the `orgEventAction: (payload) => request('/org/events', { method: 'POST', body: payload }),` line, add:
```js
  orgEventLines: (eventId) => request(`/org/events?eventId=${encodeURIComponent(eventId)}`),
  orgEventQuotes: () => request('/org/events?quotes=1'),
```
(The existing `contribute(slug, payload)` already forwards `payload`, so a `lineItemId` field is passed through with no change.)

- [ ] **Step 2: Verify + commit**

Run: `node --check src/lib/api.js` (expect no output), then:
```bash
git add src/lib/api.js
git commit -m "feat(api): orgEventLines + orgEventQuotes client methods"
```

---

### Task 8: Organizer UI — per-event Funding panel

**Files:**
- Modify: `src/pages/OrgEvents.jsx`

- [ ] **Step 1: Add a `FundingLines` component**

In `src/pages/OrgEvents.jsx`, add these imports to the existing import block:
```jsx
import { fromMinor, toMinor } from '../lib/money.js'
```
(Replace the existing `import { toMinor } from '../lib/money.js'` line with the line above.)

Then, above `export default function OrgEvents() {`, add the component:
```jsx
const DELIVERY = ['pending', 'booked', 'delivered']

function FundingLines({ event, canWrite }) {
  const [lines, setLines] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [draft, setDraft] = useState({ label: '', goal: '' })
  const [pickQuote, setPickQuote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { const r = await api.orgEventLines(event.id); setLines(r.lines || []) } catch { setLines([]) }
  }, [event.id])
  useEffect(() => { load(); api.orgEventQuotes().then((r) => setQuotes(r.quotes || [])).catch(() => {}) }, [load])

  const act = async (payload) => { setBusy(true); try { await api.orgEventAction(payload); await load() } catch { /* noop */ } finally { setBusy(false) } }
  const addLine = async () => {
    if (!draft.label.trim()) return
    await act({ action: 'line_upsert', eventId: event.id, label: draft.label, target_amount: toMinor(parseFloat(draft.goal) || 0, 'GHS'), sort: (lines?.length || 0) })
    setDraft({ label: '', goal: '' })
  }

  if (lines === null) return <p className="text-ink/40 text-xs mt-3">Loading funding lines…</p>

  return (
    <div className="mt-4 pt-4 border-t border-plum/10 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wider text-ink/45">Funding lines</p>
        {canWrite && quotes.length > 0 && (
          <div className="flex items-center gap-2">
            <select value={pickQuote} onChange={(e) => setPickQuote(e.target.value)} className="text-xs rounded-lg border border-plum/15 bg-cream px-2 py-1">
              <option value="">Import from a lead…</option>
              {quotes.map((q) => <option key={q.inquiryId} value={q.inquiryId}>{q.label}</option>)}
            </select>
            <button type="button" disabled={!pickQuote || busy} onClick={() => act({ action: 'import_lines', eventId: event.id, inquiryId: pickQuote })}
              className="text-xs rounded-full bg-plum text-cream px-3 py-1.5 disabled:opacity-50">Import</button>
          </div>
        )}
      </div>

      {lines.length === 0 ? <p className="text-ink/45 text-xs">No lines yet — import from a lead's quote or add one below.</p> : (
        <ul className="space-y-2">
          {lines.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="flex-1 min-w-[120px] text-ink/80">{l.label} {l.visible ? '' : <span className="text-ink/40 text-xs">(hidden)</span>}</span>
              <span className="tnum text-plum">{fromMinor(l.target_amount, 'GHS')} GH₵</span>
              <select value={l.delivery_status} disabled={!canWrite} onChange={(e) => act({ action: 'line_delivery', id: l.id, delivery_status: e.target.value })}
                className="text-xs rounded-lg border border-plum/15 bg-cream px-2 py-1">
                {DELIVERY.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <button type="button" disabled={!canWrite} onClick={() => act({ action: 'line_upsert', id: l.id, label: l.label, target_amount: l.target_amount, sort: l.sort, visible: l.visible ? false : true })}
                className="text-xs text-ink/50 link-underline disabled:opacity-50">{l.visible ? 'Hide' : 'Show'}</button>
              <button type="button" disabled={!canWrite} onClick={() => act({ action: 'line_delete', id: l.id })}
                className="text-xs text-terracotta link-underline disabled:opacity-50">Delete</button>
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <div className="flex flex-wrap items-end gap-2 pt-1">
          <Field className="flex-1 min-w-[140px]" label="New line" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Catering" />
          <Field label="Target (GH₵)" type="number" value={draft.goal} onChange={(e) => setDraft({ ...draft, goal: e.target.value })} />
          <Button onClick={addLine} variant="outline" size="sm" loading={busy}>Add</Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Render the panel inside each event row**

In `OrgEvents.jsx`, the event row currently ends with the `</div>` that closes the row wrapper opened by `<div key={e.id} className="rounded-2xl bg-cream-deep border border-plum/8 p-5 flex flex-wrap items-center justify-between gap-3">`. Restructure that row so the `FundingLines` panel sits below the header/actions:

Replace:
```jsx
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
```
with:
```jsx
              <div key={e.id} className="rounded-2xl bg-cream-deep border border-plum/8 p-5">
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
                <FundingLines event={e} canWrite={canWrite} />
              </div>
```

- [ ] **Step 3: Build + commit**

Run: `npm run build` (expect exit 0), then:
```bash
git add src/pages/OrgEvents.jsx
git commit -m "feat(org): per-event funding-lines panel (import/add/hide/delete/delivery)"
```

---

### Task 9: Public UI — fund a specific part

**Files:**
- Modify: `src/pages/EventPage.jsx`

- [ ] **Step 1: Thread `lineItems` into the contribution area and let a giver pick a line**

In `src/pages/EventPage.jsx`, change the destructure of the loaded data (currently `const { event, schedule, gallery, contributions } = data`) to include the new field:
```jsx
  const { event, schedule, gallery, contributions, lineItems = [] } = data
```

Update the `ContributionPool` usage (currently `<ContributionPool slug={slug} event={event} data={contributions} />`) to pass the lines:
```jsx
            <ContributionPool slug={slug} event={event} data={contributions} lineItems={lineItems} />
```

- [ ] **Step 2: Render the line list + selected-line chip inside `ContributionPool`**

Change the `ContributionPool` signature to accept `lineItems`:
```jsx
function ContributionPool({ slug, event, data, lineItems = [] }) {
```

Add selected-line state next to the existing `useState` hooks in `ContributionPool`:
```jsx
  const [lineId, setLineId] = useState(null)
  const selectedLine = lineItems.find((l) => l.id === lineId) || null
```

Include `lineItemId` in the contribute call — change `const res = await api.contribute(slug, { ...form, amount })` to:
```js
      const res = await api.contribute(slug, { ...form, amount, lineItemId: lineId })
```

Then, inside the `ContributionPool` returned JSX, immediately after the opening `<div className="grid lg:grid-cols-2 gap-8 items-start">` add a full-width line picker (it spans both columns):
```jsx
      {lineItems.length > 0 && (
        <div className="lg:col-span-2 rounded-3xl bg-cream-deep border border-plum/8 p-6">
          <h3 className="font-display text-plum text-xl mb-1">Fund a specific part</h3>
          <p className="text-ink/55 text-sm mb-4">Choose what your gift goes toward — or give to the whole celebration.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {lineItems.map((l) => (
              <button key={l.id} type="button" onClick={() => setLineId(lineId === l.id ? null : l.id)}
                className={`text-left rounded-2xl border p-4 transition-colors ${lineId === l.id ? 'border-plum bg-plum/5' : 'border-plum/12 hover:border-plum/40'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-plum">{l.label}</span>
                  {l.delivery_status !== 'pending' && (
                    <span className="text-[10px] uppercase tracking-wide text-kente">✓ {l.delivery_status}</span>
                  )}
                </div>
                <div className="mt-2 flex items-baseline justify-between text-sm">
                  <span className="tnum text-ink/70">{formatMoney(l.raised, event.currency)}{l.target > 0 && <span className="text-ink/40"> of {formatMoney(l.target, event.currency)}</span>}</span>
                  {l.pct !== null && <span className="tnum text-terracotta text-xs">{l.pct}%</span>}
                </div>
                {l.pct !== null && (
                  <div className="mt-2 h-1.5 rounded-full bg-plum/10 overflow-hidden">
                    <div className="h-full rounded-full bg-champagne" style={{ width: `${l.pct}%` }} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
```

Finally, show which line a gift is going to — inside the gift `<form>`, right after the `<h3 ...>Send a gift</h3>` line, add:
```jsx
        {selectedLine && (
          <p className="text-sm text-ink/60 -mt-2">
            Giving toward <span className="text-plum font-medium">{selectedLine.label}</span>
            <button type="button" onClick={() => setLineId(null)} className="ml-2 text-terracotta text-xs link-underline">give generally instead</button>
          </p>
        )}
```

- [ ] **Step 3: Build + commit**

Run: `npm run build` (expect exit 0), then:
```bash
git add src/pages/EventPage.jsx
git commit -m "feat(funding): fund a specific part on the public event page"
```

---

### Task 10: Migrate live D1, deploy, verify

**Files:** none (operational). Requires the correct wrangler login (**ghwmelite@gmail.com / acct ea2eb3a9…**).

- [ ] **Step 1: Tests + build**

Run: `node scripts/test-funding.mjs && npm run build`
Expected: `OK: funding helper assertions passed`, then a clean build.

- [ ] **Step 2: Migrate the live D1 (one-off)**

Run:
```bash
npx wrangler d1 execute gather-ghana --remote --yes --file=./migrations/add-event-funding.sql
```
Expected: success. (One-off — the two `ALTER`s error if re-run; that's fine.)

- [ ] **Step 3: Deploy to production**

Run: `npx wrangler pages deploy dist --project-name gather-ghana-events --branch main --commit-dirty=true`
Expected: "Deployment complete".

- [ ] **Step 4: Manual verification on production**

1. As an organizer: open `/org/events`, pick an event → **Funding lines** → either **Import from a lead** (a lead that has run an Instant Quote hand-off) or **Add** a line (e.g. "Catering", target 4000). Toggle one line's delivery to **booked**.
2. `GET https://gge.ohwpstudios.org/api/events/<slug>` returns a `lineItems` array with `label`, `raised`, `target`, `pct`, `delivery_status`.
3. On `/e/<slug>`: the **"Fund a specific part"** list shows the visible lines with progress bars; selecting one and starting a gift shows "Giving toward <line>"; a real (test-mode) Paystack contribution to that line increments only that line's `raised` after reconciliation.
4. A gift with no line selected still works and counts only toward the general pool.
5. As a **viewer** (read-only): the `/org/events` funding controls are disabled and a direct `POST /api/org/events {action:'line_upsert'}` returns 403.

- [ ] **Step 5: Finish the branch**

Use `superpowers:finishing-a-development-branch` to merge `feat/fund-my-event` to `main` (and push).

---

## Self-Review Notes

- **Spec coverage:** `event_line_items` + `contributions.line_item_id` + `inquiries.quote_json` → Task 1; pure helpers (`lineItemsFromQuote`, `progressPct`) + test → Task 2; quote persistence (concierge → inquiry) → Task 3; public read returns line items + progress → Task 4; targeted contribution → Task 5; organizer import/curate/delivery (currentEditor-gated) → Task 6; client methods → Task 7; organizer funding panel → Task 8; public "fund a specific part" → Task 9; migrate + deploy + verify → Task 10. Money model stays Option A throughout (no custody; contributions settle to the single merchant account; "release" is delivery status, not a transfer).
- **Name consistency:** helper names `lineItemsFromQuote`/`progressPct` defined in Task 2 and imported in Tasks 4 & 6; the public line shape `{ id, label, target, raised, pct, delivery_status }` produced in Task 4 and consumed in Task 9; contribute field `lineItemId` sent by Task 9's UI, accepted in Task 5, forwarded by the unchanged `api.contribute`; org actions `create|delete|import_lines|line_upsert|line_delete|line_delivery` match between Task 6 (endpoint) and Tasks 7–8 (client + UI); `delivery_status` domain `pending|booked|delivered` shared by Task 1 (default), Task 6 (`DELIVERY` whitelist), Task 8 (`DELIVERY` select), Task 9 (badge).
- **Honesty guard:** no "held"/"protected"/"escrow" copy is introduced anywhere in the funding UI (Tasks 8–9); reassurance is the delivery badge + transparent per-line progress only.
- **Backward compatibility:** `line_item_id` is nullable; events with no line items return `lineItems: []` and the existing general pool renders unchanged; a null-line contribution is still valid.
- **YAGNI:** no couple self-serve creation, no vendor subaccounts, no refunds, no contributor notifications — all deferred per the spec.
