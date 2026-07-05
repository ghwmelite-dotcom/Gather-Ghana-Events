# Services catalog (admin-editable) — design · Phase A

**Date:** 2026-07-05
**Status:** Approved (pending spec review)

## Problem & goal

The public `/services` page is fully hardcoded: a descriptive section (`detailed` array in
`Services.jsx`) and a pricing grid (`packages` in `src/lib/content.js`) — the same three offerings
(Weddings, Celebrations, Corporate) presented twice. Goal: make the service offerings + pricing an
**admin-managed catalog** backed by the database, so the organizer edits them without code changes.

This is **Phase A** of the "make the Services page editable" work. **Phase B** (Process steps, FAQ,
testimonials — modelled together via a generic `site_content` table) is a separate spec/plan to
follow.

## Decisions locked

- **Unified model:** one `services` row drives BOTH the descriptive section and the pricing card.
- **Scope:** Services offerings + pricing only. Process steps, FAQ, and testimonials are untouched
  (Phase B).
- **Image:** a plain URL string field (admin pastes a URL); seeded from the current Unsplash images.
- **Price:** stored as **whole GH₵** (matches the current `from` values and the `fmtGhs` usage on
  the page). Not minor units.
- Create/update/delete are **organizer-gated and viewer-blocked** (`currentEditor`), consistent with
  the read-only viewer role.

## Non-goals (YAGNI)

- No Phase-B content (process/FAQ/testimonials).
- No image upload (URL field only).
- No per-service custom CTAs, SEO, or slugged detail pages — this drives the existing `/services`
  sections only.
- No drag-and-drop ordering (a numeric `sort` field).

## Design

### Data model — `services` (new table)
Added to `schema.sql` and applied to live D1 via a seed migration:
```sql
CREATE TABLE IF NOT EXISTS services (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  tagline     TEXT,
  description TEXT,
  image       TEXT,                        -- image URL
  features    TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  price_from  INTEGER NOT NULL DEFAULT 0,   -- whole GH₵
  featured    INTEGER NOT NULL DEFAULT 0,
  published   INTEGER NOT NULL DEFAULT 1,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_services_published ON services(published, sort);
```

### Seed (`migrations/add-services.sql`)
`CREATE TABLE IF NOT EXISTS` (as above) + `INSERT OR IGNORE` the three current services (fixed ids
`svc_weddings|svc_celebrations|svc_corporate` so re-runs are safe), unifying the current data:
- **Weddings** — tagline "Full planning, design & day-of coordination"; description = the current
  `detailed` Weddings copy; image `https://images.unsplash.com/photo-1661332517932-2d441bfb2994?auto=format&fit=crop&w=1000&q=80`;
  features = the current pricing features (5 items); `price_from 35000, featured 1, published 1, sort 1`.
- **Celebrations** — tagline "Birthdays, anniversaries & milestones"; current Celebrations
  description; image `…photo-1618999114008-fbf937170cdb…w=1000…`; 5 features;
  `price_from 18000, featured 0, published 1, sort 2`.
- **Corporate** — tagline "Launches, galas & conferences"; current Corporate description; image
  `…photo-1768508950719-4d76978fdf44…w=1000…`; 5 features; `price_from 25000, featured 0, published 1, sort 3`.

### Public API — `functions/api/services/index.js` (new)
`onRequestGet` (no auth): `SELECT * FROM services WHERE published = 1 ORDER BY sort ASC, created_at ASC`;
returns `{ services: [...] }` with `features` JSON-parsed to a string array (`featured`/`published`
coerced to booleans is optional — the page reads `featured` truthiness).

### Admin API — `functions/api/org/services.js` (new)
Follows the `/api/org/*` conventions:
- `onRequestGet` — `currentOrganizer`-gated; `SELECT * FROM services ORDER BY sort ASC` (incl.
  unpublished); `features` parsed.
- `onRequestPost` — `currentEditor`-gated (viewers → 403):
  - `create` → validate `name` (422 if empty); INSERT with `features = JSON.stringify(array||[])`,
    `price_from = Math.max(0, parseInt)`, `featured/published` 0/1, `sort` int; `logActivity`
    (`service.create`) → `{ id }`.
  - `update` → by `id`; same field normalization; 404 if not found; `logActivity` (`service.update`).
  - `delete` → by `id`; `logActivity` (`service.delete`) → `{ deleted: true }`.

### API client — `src/lib/api.js`
- `services: () => request('/services')`
- `orgServices: () => request('/org/services')`
- `orgServiceAction: (payload) => request('/org/services', { method: 'POST', body: payload })`

### Admin page — `src/pages/OrgServices.jsx` (new) + route
- Organizer-gated UX like the other org pages (loads `api.orgServices()`; forbidden/error/loading
  states; `canWrite` from `useAuth()` disables mutating controls for viewers).
- Header "Services" (dark plum band, back-to-dashboard link).
- **List:** each service row — name, `from GH₵`, **Featured**/**Published** badges, `sort` — with
  **Edit** and **Delete** (confirm) actions.
- **Create/Edit form** (inline panel): `name` (required), `tagline`, `description` (textarea),
  `image` (URL), **features** editor (a list of text inputs with add/remove row), `price_from`
  (number, GH₵), **Featured** checkbox, **Published** checkbox, `sort` (number). Submits via
  `api.orgServiceAction({ action: 'create'|'update', ... })`; Save disabled when `!canWrite`.
- Route `/org/services` → `OrgServices` inside `<ProtectedRoute>` in `src/main.jsx`.
- Dashboard quick-links: add **"Services"** → `/org/services`.

### Public rewire — `src/pages/Services.jsx`
- Fetch `api.services()` on mount into state; show a brief `Spinner` while loading; if the fetch
  fails or returns empty, render nothing for those two sections (the rest of the page still renders).
- The descriptive section maps over the fetched services: `image`, `name` (title), `description`,
  `features` (the "includes" bullet list).
- The `Pricing` section maps over the same services: `name`, `tagline`, `price_from` (via `fmtGhs`),
  `features`, `featured` (styling + "Most popular").
- Remove the hardcoded `detailed` array and the `import { packages }`. Also remove the now-unused
  `packages` export from `src/lib/content.js` (it is imported nowhere else).
- `process`, `Pricing` wrapper copy, `FAQ` remain as-is (Phase B).

## Data flow

Admin edits at `/org/services` → `POST /api/org/services` (create/update/delete) → the public
`GET /api/services` reflects published rows → `Services.jsx` renders both sections from that one
source. Seed guarantees the page shows the current three services immediately on launch.

## Error handling

- Create/update: `name` required (422 with field error); non-organizer/viewer → 403; unknown id on
  update/delete → 404.
- `features` parse: the API JSON-parses defensively (`try/catch` → `[]`) so a malformed row never
  500s the public page.
- Public page: fetch failure → sections render empty (no crash); the page's static parts still show.

## Testing

- A small pure helper `parseFeatures(str)` (safe JSON→array of strings) in a new
  `functions/_lib/services.js`, used by both the public and admin GET endpoints, unit-tested via a
  `node` assertion (valid array, malformed → `[]`, non-array → `[]`).
- `npm run build`, `node --check` on the new function files.
- Manual on a deploy:
  1. `/services` shows the three seeded offerings + pricing (matches today) — now from the DB.
  2. `/org/services` (as organizer): create a 4th service (published) → it appears on `/services`
     in both sections; toggle Published off → it disappears; edit price/features → reflected; delete
     → gone.
  3. As a **viewer**: `/org/services` lists services but create/edit/delete are disabled; a direct
     `POST /api/org/services` returns 403.
  4. Featured styling + ordering (`sort`) behave as configured.

## Deploy

Requires a live D1 migration: `npx wrangler d1 execute gather-ghana --remote --file=./migrations/add-services.sql`
(creates the table + seeds the 3 services), then the standard `wrangler pages deploy`.

## Sequencing

Single Phase-A plan. Order: schema + migration/seed → `parseFeatures` helper (+test) → public API →
admin API → api client → `OrgServices.jsx` + route → public `Services.jsx` rewire + `content.js`
cleanup → dashboard nav → migrate live D1, deploy, verify. **Phase B** follows as its own spec.
