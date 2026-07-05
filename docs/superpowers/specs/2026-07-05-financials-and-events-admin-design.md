# Financials rename + admin Events page — design

**Date:** 2026-07-05
**Status:** Approved (pending spec review)

## Problem & goal

Two admin-dashboard improvements:
1. **"Books" is mis-labelled.** The `/org/books` screen is a financial ledger (revenue, costs,
   margins, exports), not a bookings list. Rename it to **Financials**.
2. **No easy place to create/manage event pages.** Event-page creation exists only as a cramped
   form buried in the dashboard sidebar, with no dedicated page, no management (delete), and a
   backend gap (creation is not organizer-gated). Give it a real, discoverable admin home.

Services management is explicitly **out of scope** (deferred to a separate future project — the
`/services` page is fully static with no data model).

## Decisions locked

- Rename label only; the `/org/books` **URL stays** (internal route, no redirect).
- New dedicated **`/org/events`** admin page: create form + list with **View** and **Delete**.
- The dashboard's inline create form is **removed** and replaced by a link to `/org/events`.
- Event create/delete are **organizer-gated and viewer-blocked** (`currentEditor`); listing uses
  `currentOrganizer` (viewers may view).
- Event-creation insert logic is extracted into a shared helper (DRY across the public and admin
  endpoints).

## Non-goals (YAGNI)

- No event **editing** (create + delete only this round).
- No services data model / admin / API.
- No change to the public `/e/:slug` event page or the dashboard's events *list* data source.
- No change to the `/org/books` route/URL or the financial logic itself.

## Design

### Part A — "Books" → "Financials"
Relabel in exactly these places (URL `/org/books` unchanged):
- `src/pages/OrgDashboard.jsx` — the quick-link nav item labelled "Books".
- `src/pages/OrgClient.jsx` — the "Books" link.
- `src/pages/OrgBooks.jsx` — the `<Seo title>` ("Books · Organizer" → "Financials · Organizer") and
  the page `<h1>` ("Books" → "Financials").

### Part B — Admin Events

#### B1. Shared helper — `functions/_lib/events.js` (new)
Extract the event-record insert (the `events` INSERT plus optional `event_schedule` items) from
`functions/api/events/index.js` into an exported async helper, e.g.:
`createEventRecord(db, ownerEmail, body) → { id, slug }`.
It performs the same validation/normalization currently in the public endpoint (title required,
currency/visibility whitelists, goal in minor units, slug = slugify(title)+random suffix, schedule
items capped at 30). Behavior must be identical to today's public endpoint.

#### B2. Public endpoint refactor — `functions/api/events/index.js`
`onRequestPost` keeps its `currentClientId` auth and now delegates the insert to
`createEventRecord(db, owner?.email || null, body)`. No behavior change (verified by the same
`/e/:slug` flow working after).

#### B3. New admin endpoint — `functions/api/org/events.js` (new)
Follows the existing `/api/org/*` conventions (`ok`/`fail`/`readJson`, action-based POST):
- `onRequestGet` — `currentOrganizer`-gated; returns `{ events: [...] }` — each event's
  `id, slug, title, event_type, event_date, visibility, created_at`, newest first, `LIMIT 200`.
- `onRequestPost` — `currentEditor`-gated (viewers → 403 "Read-only access — this action isn't
  available."):
  - `action: 'create'` → `createEventRecord(db, org.email, body)` → `{ id, slug }`;
    also `logActivity` (`event.create`).
  - `action: 'delete'` → validate `id`; explicitly delete child rows then the event in a single
    `env.DB.batch([...])` — `DELETE FROM event_schedule/event_gallery/rsvps/contributions WHERE
    event_id = ?` then `DELETE FROM events WHERE id = ?`. (The tables declare `ON DELETE CASCADE`,
    but D1 only enforces FKs when `PRAGMA foreign_keys` is on, so we delete children explicitly to
    be deterministic.) Then `logActivity` (`event.delete`) → `{ deleted: true }`.

#### B4. API client — `src/lib/api.js`
Add:
- `orgEvents: () => request('/org/events')`
- `orgEventAction: (payload) => request('/org/events', { method: 'POST', body: payload })`

#### B5. New page — `src/pages/OrgEvents.jsx`
- Organizer-gated UX identical to the other org pages (loads `api.orgEvents()`; on 401/403 shows the
  standard "Organizer access only" screen; reads `canWrite` from `useAuth()` to disable create/delete
  for viewers).
- Header consistent with other org pages (dark plum band, back-to-dashboard link, title "Events").
- **Create card:** the same fields as the current form (Title required, Host names, Type, Date,
  Venue, Location, Goal GH₵), submitting via `api.orgEventAction({ action: 'create', ... ,
  contribution_goal: toMinor(...) })`; on success shows the new `/e/slug` link and refreshes the list.
  Submit disabled when `!canWrite`.
- **Events list:** each row shows title · type · date · visibility, a **View** link to `/e/slug`
  (new tab), and a **Delete** button (confirm dialog) calling
  `api.orgEventAction({ action: 'delete', id })`; Delete disabled/hidden when `!canWrite`.

#### B6. Routing — `src/main.jsx`
Add `/org/events` → `OrgEvents` inside `<ProtectedRoute>`, alongside the other org routes.

#### B7. Dashboard changes — `src/pages/OrgDashboard.jsx`
- Add **"Events"** to the quick-link nav row (→ `/org/events`).
- Remove the embedded `CreateEvent` component and its render; replace it with a compact card/CTA
  **"＋ New event page →"** linking to `/org/events`. The existing events *list* on the dashboard is
  kept as-is (its data comes from `orgOverview`, unchanged).

## Data flow

Organizer opens `/org/events` → `GET /api/org/events` lists events → create form
`POST {action:'create'}` inserts via `createEventRecord` → new `/e/slug` page is live and appears in
the list → Delete `POST {action:'delete'}` removes it (cascading child rows). The public
self-serve/`inquiry`→event path via `POST /api/events` is unchanged (now sharing the same helper).

## Error handling

- Create: title required (422 with field error, as today); non-organizer/viewer → 403.
- Delete: unknown id → 404; viewer → 403; confirm dialog in the UI before calling.
- List endpoint failure or 401/403 → the page shows the standard forbidden/error state.

## Testing

Mostly wiring + a refactor. Verify:
- (Optional) a tiny `node` sanity check is not applicable (helper depends on D1 + Math.random); rely
  on build + manual.
- `npm run build` clean; `node --check` on the two new/changed function files.
- Manual on a deploy:
  1. Dashboard nav shows **Financials** (not Books) and **Events**; `/org/books` still loads and its
     header reads **Financials**.
  2. Dashboard no longer has the inline create form — instead a "New event page" CTA to `/org/events`.
  3. `/org/events`: create an event → it appears in the list and `/e/slug` is live; Delete removes it
     and it disappears from the list (and `/e/slug` 404s).
  4. As a **viewer** (read-only role): `/org/events` loads and lists events, but create/delete are
     disabled and a direct `POST /api/org/events` returns 403.
  5. The public event flow (existing `/e/:slug`) is unaffected.

## Sequencing

Single plan. Order: rename (A) → `events.js` helper + public-endpoint refactor → `/api/org/events`
endpoint → api client → `OrgEvents.jsx` + route → dashboard nav/CTA swap → build, verify, deploy.
