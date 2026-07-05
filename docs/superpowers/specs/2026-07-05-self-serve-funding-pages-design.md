# Couple Self-Serve Funding Pages — Design Spec (Fund-my-Event v2)

**Date:** 2026-07-05
**Status:** Approved design, pre-plan
**Builds on:** `docs/superpowers/specs/2026-07-05-fund-my-event-design.md` (line-itemized event funding, already shipped)

## Goal

Let a couple build and share **their own** funding page — from their saved Instant Quote, in their client portal — instead of waiting for an organizer to create it. This increases self-serve reach while staying honest about the single-Paystack-account money model: the page is viewable/shareable immediately, but **cannot accept money until an organizer accepts it**.

## The three settled decisions

1. **Money guardrail = organizer-approval gate.** Contributions still land in the studio's single Paystack merchant account and the studio disburses (no custody, no couple sub-accounts). A self-serve page is created with **`contributions_enabled = 0`**; an organizer flips it to `1` ("Accept & enable funding") from a pending queue. This protects the studio from collecting money for events it hasn't taken on. Nothing about the contribution/reconcile rail changes.
2. **Home = the client portal.** Creation and management require a magic-link client session (`currentClientId`). Sign-in is itself an abuse guardrail.
3. **Scope = funding-focused.** The couple edits page basics (title, host names, event date, cover image, short story) + funding lines (import from their quote, add/edit/hide, set targets). Schedule, gallery, RSVP settings, and **delivery status stay studio-managed** (delivery represents a studio commitment).

## Non-goals (v1)

- Couple Paystack subaccounts / split routing (studio-settled only).
- Schedule / gallery / RSVP / livestream editing by the couple.
- Client-set `delivery_status`.
- More than one self-serve funding page per couple.
- Contributor notifications.

## Architecture

Additive on the shipped Fund-my-Event rail (`event_line_items`, `contributions.line_item_id`, `inquiries.quote_json`, `functions/_lib/funding.js`). One new column; one new client endpoint; small extensions to the organizer endpoint and the public event page.

### Data model

**Add one column:**
```sql
ALTER TABLE events ADD COLUMN self_serve INTEGER NOT NULL DEFAULT 0;  -- 1 = couple-built page
```
(Also added to `schema.sql`'s `events` definition for fresh DBs.)

State semantics (reusing existing columns):
- `self_serve = 1` → couple-built; drives the public preview state and the organizer approval queue.
- `contributions_enabled = 0` on a `self_serve` page → **pending studio approval** (money OFF).
- `contributions_enabled = 1` → **accepted / live** (money ON, via the unchanged contribute rail).
- `owner_email` = the couple's client email (ownership); `inquiry_id` = their lead (quote source + portal lookup).
- `visibility = 'unlisted'` on create → shareable by link, not discoverable/indexed, until an organizer chooses otherwise.

### `createEventRecord` (extend — `functions/_lib/events.js`)

Add `self_serve` to the INSERT, sourced from `body.self_serve ? 1 : 0` (default 0 — organizer creates are unaffected). This keeps a single insert path.

### Client endpoint — `functions/api/portal/funding.js` (new)

All actions require `currentClientId`; all management actions verify ownership (`owner_email = <client email>` AND `self_serve = 1`).

- **`GET`** → `{ event, lineItems, canCreate }` for the signed-in client's self-serve page (their most recent `self_serve` event), or `{ event: null, canCreate: <bool>, inquiry: {id, quote_json?} }` if none yet. `lineItems` include `id, label, target, raised, pct, delivery_status` (via the same query shape as the public read).
- **`POST { action }`:**
  - `create` — creates the page from the client's **primary inquiry** (most recent). Calls `createEventRecord(db, clientEmail, { title, host_names, event_date, cover_image, story, inquiry_id, self_serve: true, contributions_enabled: false, visibility: 'unlisted' })`. **Server forces** `contributions_enabled=false` + `visibility='unlisted'` regardless of input. Rejects with 409 if the client already owns a `self_serve` event.
  - `update` — updates basics (`title, host_names, event_date, cover_image, story`) on the client's own page. Never touches `contributions_enabled`, `self_serve`, `visibility`, or `delivery_status`.
  - `import_lines` — reads the client's own inquiry `quote_json` → `lineItemsFromQuote` → inserts `event_line_items` for their event (409 if lines already exist, matching the org endpoint).
  - `line_upsert` — add/edit a line (`label, target_amount, sort, visible`) on the client's own event. **No `delivery_status`.**
  - `line_delete` — delete a line on the client's own event; reattaches its contributions to the general pool (`UPDATE contributions SET line_item_id = NULL …`) then deletes, matching the org endpoint.

### Organizer endpoint — `functions/api/org/events.js` (extend)

- **GET list**: add `self_serve` and `contributions_enabled` to the selected columns so the UI can flag pages **pending approval** (`self_serve = 1 AND contributions_enabled = 0`).
- **New POST action `accept_self_serve { id }`** (`currentEditor`): sets `contributions_enabled = 1` on the event, logs `funding.accept` activity. Visibility is left as-is (the couple shares the link; an organizer can still change visibility elsewhere).

### Legacy endpoint hardening — `functions/api/events/index.js`

This existing public create currently passes the client's `body` straight to `createEventRecord`, which would let any signed-in client create a **public, contributions-enabled** event — bypassing the approval gate. Harden it: for this client-facing path, **force** `contributions_enabled = false`, `visibility = 'unlisted'`, `self_serve = true` before calling `createEventRecord` (organizers create via `/api/org/events`, which is unchanged). Closes the pre-existing hole and keeps the money guarantee intact.

### Public event page — `functions/api/events/[slug].js` + `src/pages/EventPage.jsx`

- Public read: add `self_serve` to the event SELECT (it already returns `contributions_enabled` and `lineItems`).
- `EventPage.jsx`:
  - `contributions_enabled` → existing `ContributionPool` (with the line picker). Unchanged.
  - else if `self_serve && lineItems.length > 0` → a **read-only funding preview**: the line labels + targets with a note *"Funding opens once the studio confirms this event."* No gift form.
  - else → nothing (as today).
  - Set `noindex` when `visibility !== 'public'` so unlisted pages aren't indexed.

### Client portal UI — `src/pages/Portal.jsx` (+ a client line editor)

A "Your funding page" section:
- No page yet → **"Create your funding page"** CTA (prefilled from the couple's quote/inquiry: event date, a suggested title).
- Page exists → status badge (**Pending studio approval** / **Live**), the share link (`/e/<slug>`), a basics editor, and a **client `FundingLines` editor** — import from quote, add/edit/hide/delete lines, set targets. **No delivery control** (that column is absent for the couple).
- New client methods in `src/lib/api.js`: `portalFunding()` (GET), `portalFundingAction(payload)` (POST).

### Data flow

1. Couple signs into `/portal` (magic link).
2. "Create your funding page" → `portal/funding.js` `create` → event (`self_serve=1, contributions_enabled=0, visibility='unlisted', owner=couple, inquiry_id=primary`).
3. "Import my quote" → `import_lines` from their `inquiry.quote_json` → `event_line_items`.
4. Couple curates lines + basics, shares `/e/<slug>`. Public page shows the **preview** (no gift form).
5. Organizer sees it in the **pending queue** on `/org/events` → **Accept & enable funding** → `contributions_enabled = 1`.
6. Public page now shows the normal gift flow; contributions settle to the studio account (existing rail); the studio disburses; delivery status is organizer-managed.

## Trust, guardrails & error handling

- **Money gate is server-enforced:** self-serve create forces `contributions_enabled = 0`; only `accept_self_serve` (organizer, `currentEditor`) enables it. The contribute endpoint is unchanged — it already refuses when `contributions_enabled` is off — so no money flows pre-approval.
- **Ownership:** every client management action verifies `owner_email` + `self_serve` (403/404 otherwise). A client cannot edit an organizer-built page or another couple's page.
- **Sign-in required** for all creation/management (401 otherwise).
- **One page per couple** (409 on duplicate create) — implicit rate limit.
- **No "escrow/held/protected" language** anywhere (consistent with v1); the preview copy is "Funding opens once the studio confirms this event."
- **Unlisted-by-default** keeps self-serve pages undiscoverable + `noindex` until an organizer/owner chooses otherwise.
- **Delivery status** is never client-editable.

## Testing

- Reuse `lineItemsFromQuote`/`progressPct` (already unit-tested). If a small pure ownership/create-guard helper emerges, unit-test it via `node scripts/test-*.mjs`.
- Endpoints: `node --check`; manual authenticated API round-trips (client session + organizer session per the prod-verification playbook).
- UI: `npm run build` + smoke test.
- E2E on production: sign in as a client → create page → import lines → confirm public **preview** (no gift form) + `noindex` → organizer **Accept** → confirm the gift form + line picker now appear and a contribution reconciles into a line. Clean up test rows.

## Rollout

1. `schema.sql` + `migrations/add-event-self-serve.sql` (one-off `ALTER`).
2. `createEventRecord` self_serve; harden `events/index.js`; `portal/funding.js`; org `accept_self_serve` + GET columns; public read `self_serve`; EventPage preview + noindex; Portal section + client editor + api methods.
3. Apply migration to live D1, deploy (manual wrangler), verify per the playbook.

## Open questions (non-blocking)

- On accept, should the organizer also be able to flip the page to `visibility='public'` (discoverable) in the same click? Default: no — keep it unlisted; visibility stays a separate control.
- Prefilled title on create — default to `"<host_names>'s <event_type>"` when available, else blank for the couple to fill.
