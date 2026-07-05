# Editable page content (Process · FAQ · Testimonials) — design · Phase B

**Date:** 2026-07-05
**Status:** Approved (pending spec review)

## Problem & goal

Three marketing lists remain hardcoded: the **Process** steps (in `Services.jsx`), the **FAQ**
(`faqs` in `content.js`, rendered by `FAQ.jsx` on the Services page), and **Testimonials**
(`testimonials` in `content.js`, rendered by `Testimonials.jsx` on the homepage). Goal: make all
three admin-editable through a single generic content model, completing the "make the site's
marketing content editable" work started in Phase A (Services catalog).

## Decisions locked

- **One generic `site_content` table** handles all three types (they are simple ordered lists).
- **Process numbers are auto-generated** (01, 02, 03…) from display order — the admin edits only
  title + description.
- **Testimonial stars stay a fixed 5** (not editable) — matches today.
- One grouped public endpoint (`GET /api/content`) and one admin page (`/org/content`) with three
  sections.
- Create/update/delete are organizer-gated and viewer-blocked (`currentEditor`).

## Non-goals (YAGNI)

- No new content types beyond process/faq/testimonial.
- No rich text / markdown — plain text fields.
- No per-testimonial star rating, avatar, or per-item CTA.
- No changes to the Services catalog (Phase A) or any other page.

## Design

### Data model — `site_content` (new table)
Added to `schema.sql`; applied to live D1 via a seed migration:
```sql
CREATE TABLE IF NOT EXISTS site_content (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,          -- 'process' | 'faq' | 'testimonial'
  data       TEXT NOT NULL DEFAULT '{}',  -- JSON object, shape per type
  sort       INTEGER NOT NULL DEFAULT 0,
  published  INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_site_content ON site_content(type, published, sort);
```
`data` shape by type:
- **process:** `{ "title": "...", "desc": "..." }`
- **faq:** `{ "q": "...", "a": "..." }`
- **testimonial:** `{ "quote": "...", "name": "...", "event": "..." }`

### Seed (`migrations/add-site-content.sql`)
`CREATE TABLE IF NOT EXISTS` + `INSERT OR IGNORE` the current content with fixed ids
(`sc_process_1..4`, `sc_faq_1..5`, `sc_testimonial_1..3`) so re-runs are safe: the 4 Process steps
(Discover/Design/Coordinate/Deliver), the 5 FAQs, and the 3 testimonials, each with `sort` 1..n,
`published 1`.

### Shared helper — `functions/_lib/site-content.js` (new)
- `parseData(str)` → the JSON object or `{}` on malformed/non-object input.
- `groupContent(rows)` → `{ process:[], faq:[], testimonial:[] }`, each item
  `{ id, ...parsedData, sort, published }`, preserving the SQL order; unknown types ignored.
Unit-tested via a `node` assertion (valid/malformed data, grouping, unknown-type skip, order).

### Public API — `functions/api/content/index.js` (new)
`onRequestGet` (no auth): `SELECT id, type, data, sort, published FROM site_content WHERE
published = 1 ORDER BY type ASC, sort ASC, created_at ASC`; returns `groupContent(results)` (i.e.
`{ process, faq, testimonial }`).

### Admin API — `functions/api/org/content.js` (new)
- `onRequestGet` — `currentOrganizer`-gated; all rows (incl. unpublished), grouped via
  `groupContent`.
- `onRequestPost` — `currentEditor`-gated (viewers → 403):
  - `create` → validate `type` in the whitelist; store `data` as normalized JSON (each string value
    clamped); `logActivity` (`content.create`) → `{ id }`.
  - `update` → by `id`; 404 if missing; same normalization; `logActivity` (`content.update`).
  - `delete` → by `id`; `logActivity` (`content.delete`) → `{ deleted: true }`.

### API client — `src/lib/api.js`
- `content: () => request('/content')`
- `orgContent: () => request('/org/content')`
- `orgContentAction: (payload) => request('/org/content', { method: 'POST', body: payload })`

### Admin page — `src/pages/OrgContent.jsx` (new) + route + nav
- Organizer-gated UX like the other org pages (`api.orgContent()`; forbidden/error/loading;
  `canWrite` disables mutating controls).
- Three sections (**Process**, **FAQ**, **Testimonials**), each a list of items with the type's
  fields editable inline (driven by a small per-type field config), plus **add**, **delete**,
  **published** toggle, and **sort**. A single reusable "section" renders each type from its config.
- Route `/org/content` → `OrgContent` in `<ProtectedRoute>`; dashboard quick-link **"Content"**.

### Public rewire
- `FAQ.jsx` — fetch `api.content()` once, render `.faq`. While loading, render nothing; if empty,
  the section renders nothing (no crash).
- `Testimonials.jsx` — same, render `.testimonial`.
- `Services.jsx` — fetch `api.content()` for the **process** list (alongside the existing
  `api.services()` call); render the Process section from `.process`, auto-numbering `0${i+1}`.
- Remove the `faqs` and `testimonials` exports from `src/lib/content.js` (imported nowhere else
  after this).

## Data flow

Admin edits at `/org/content` → `POST /api/org/content` → public `GET /api/content` reflects
published rows → `FAQ.jsx` / `Testimonials.jsx` / `Services.jsx` render their slice. Seed ensures
the pages show today's content immediately on launch.

## Error handling

- `create`/`update`: `type` must be whitelisted (422 otherwise); viewer → 403; unknown id on
  update/delete → 404.
- `parseData` defends against malformed JSON (`→ {}`), so a bad row never 500s the public pages.
- Public components: fetch failure → the section renders nothing; the rest of the page is
  unaffected.

## Testing

- `functions/_lib/site-content.js` (`parseData`, `groupContent`) unit-tested via `node`.
- `npm run build`, `node --check` on the new function files.
- Manual on a deploy:
  1. `GET /api/content` returns the seeded process/faq/testimonial arrays.
  2. `/services` Process + FAQ and the homepage Testimonials render as before — now DB-driven.
  3. `/org/content` (organizer): add/edit/delete an item in each section → reflected on the public
     pages; unpublish → disappears; reorder via `sort` → order changes.
  4. As a **viewer**: `/org/content` lists content but add/edit/delete are disabled; a direct
     `POST /api/org/content` returns 403.

## Deploy

Live D1 migration: `npx wrangler d1 execute gather-ghana --remote --file=./migrations/add-site-content.sql`
(table + seed), then the standard `wrangler pages deploy`.

## Sequencing

Single Phase-B plan: schema + migration/seed → `content.js` helper (+test) → public API → admin API
→ api client → `OrgContent.jsx` + route + nav → rewire `FAQ.jsx`/`Testimonials.jsx`/`Services.jsx` +
`content.js` cleanup → live migration, deploy, verify.
