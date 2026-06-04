# Org Portal Admin Expansion — Design

**Date:** 2026-06-04
**Status:** Approved (design)
**Scope:** Extend the organizer portal (`/org`) with three admin capabilities, built and
deployed sequentially: (1) vendor catalog management, (2) contact-message replies + status,
(3) organizer/account management. One spec, three phases.

## Context

The organizer portal (`/org` + `/org/clients/:id`) is the only privileged surface. It manages the
day-to-day event lifecycle (leads → proposals → bookings → milestones/escrow → event pages) and
shows a read-only feed of contact messages. It does **not** manage the vendor marketplace catalog,
does not let organizers reply to messages, and has no UI to manage who is an organizer (that list
lives only in `ORGANIZER_EMAILS` in `wrangler.toml`, requiring a redeploy to change).

This work closes those three gaps.

## Shared conventions

All three features follow patterns already in the codebase:

- **Auth gate:** every new endpoint calls `currentOrganizer(request, env)` and returns 403 if absent.
- **Action-based POST handlers** like `functions/api/org/milestones.js`: a single `POST` with
  `{ action: 'create' | 'update' | 'delete' | ... }` rather than many routes.
- **Money:** integer minor units everywhere; `toMinor()` on input, `formatMoney()` on display.
- **Input hygiene:** `clampStr()` on all string inputs; `uid('prefix_')` for new ids.
- **Schema changes are additive:** new columns added to `schema.sql` (for fresh installs) **and**
  applied to the live D1 via a one-off `ALTER` file in `migrations/`, run with
  `wrangler d1 execute gather-ghana --file=... --remote`.
- **Pure helpers get unit tests** in the existing `scripts/test-money.mjs` harness (slugify,
  organizer-resolution).
- **Per-feature delivery:** code → migrate (if any) → build → `wrangler pages deploy dist` → commit
  → user review, before the next feature starts.
- **Deploy is manual** (GitHub push does not auto-deploy this Pages project):
  `npm run build` then `CLOUDFLARE_ACCOUNT_ID=ea2eb3a9813660dfca2a60e594858538 npx wrangler pages
  deploy dist --project-name=gather-ghana-events --commit-dirty=true`.

## Navigation

The `/org` dashboard gains an **admin quick-links row** (Vendors · Inbox · Team) linking to the
three new sub-pages. These links render only for organizers (the whole `/org` tree already is).
The public site header (`Layout.jsx`) is **not** touched.

---

## Feature 1 — Vendor management

**Goal:** Full CRUD over the vendor marketplace catalog from the org portal, plus the verified
badge toggle.

**Data model:** none. The `vendors` table is already complete (`id, slug, name, category, location,
tagline, about, image, price_from, currency, verified, rating, reviews_count, whatsapp, created_at`).
`category` is one of: `catering | decor | venue | photography | music | cake | makeup`.
Images are **URL strings** (no upload infrastructure exists; consistent with current seed data).

**API:** refactor `functions/api/org/vendors.js` (currently POST-verify only) into an action resource:

- `GET /api/org/vendors` → list **all** vendors including unverified, full fields, newest first.
- `POST /api/org/vendors { action }`:
  - `create` — `{ name, category, location, tagline, about, image, price_from (whole GHS), whatsapp }`.
    Generates `uid('ven_')` and a unique slug via `slugify(name)` (suffix `-2`, `-3`… on collision).
    `price_from` converted with `toMinor(_, 'GHS')`. Validates name + category required.
  - `update` — `{ id, ...fields }`. Edits any provided field; re-`toMinor` on `price_from`.
  - `delete` — `{ id }`. `vendor_reviews` cascade via existing FK.
  - `verify` — `{ id, verified }` (boolean → 1/0).

**Slug helper:** add `slugify(str)` to `functions/_lib/util.js` (lowercase, strip non-alphanumerics
to single hyphens, trim). Unit-tested.

**Frontend:** new page `src/pages/OrgVendors.jsx`, route `/org/vendors` (ProtectedRoute):
- Table/cards of all vendors with verified badge, category, price-from, edit + delete + verify
  controls.
- "Add vendor" form (category `<select>` of the 7 enums; price in whole GH₵; image URL field).
- `src/lib/api.js`: `orgVendors()` (GET) and `orgVendorAction(payload)` (POST). The old
  `orgVerifyVendor` is replaced by `orgVendorAction({ action:'verify', id, verified })`.

**Out of scope:** image upload, review moderation, vendor self-service onboarding.

---

## Feature 2 — Message replies + status

**Goal:** Turn the read-only contact-message feed into a workable inbox: reply by email and track
message state.

**Data model:** extend `messages`:
- `status TEXT NOT NULL DEFAULT 'new'` — one of `new | read | replied`.
- `replied_at INTEGER` — nullable.
- Migration: `migrations/add-message-status.sql` (`ALTER TABLE messages ADD COLUMN ...` ×2) +
  matching columns in `schema.sql`.
- **Reply bodies are NOT stored** (non-threaded by decision). The outbound reply is delivered by
  email only; we persist just `status` + `replied_at`.

**API:** new `functions/api/org/messages.js`:
- `GET /api/org/messages` → all messages, newest first, with `status`.
- `POST /api/org/messages { action }`:
  - `reply` — `{ id, body }`: loads the message, sends an email to `message.email` via Resend with
    `reply_to` set to the acting organizer's email (so the recipient's reply reaches the organizer),
    sets `status='replied'`, `replied_at=now()`. No-ops gracefully (and reports) if email unconfigured.
  - `mark` — `{ id, status }`: set `status` to `read` or `new` (used to mark-as-read on open).

**Email:** add `sendMessageReply(env, { to, name, body, replyTo })` to `functions/_lib/email.js`,
reusing the existing branded `shell()` template.

**Frontend:** new page `src/pages/OrgMessages.jsx`, route `/org/messages`:
- List all messages with status chips; clicking one expands the body + a reply composer.
- Opening a `new` message marks it `read`.
- The dashboard "Recent messages" card gains status chips and an "Inbox →" link.
- `src/lib/api.js`: `orgMessages()` (GET) and `orgMessageAction(payload)` (POST).

**Out of scope:** stored conversation threads, inbound email ingestion, attachments.

---

## Feature 3 — Organizer / account management

**Goal:** Manage who is an organizer from the UI instead of editing `ORGANIZER_EMAILS` and
redeploying. Source of truth moves to the database, with config as an un-lockout-able bootstrap.

**Data model:** extend `clients`:
- `is_organizer INTEGER NOT NULL DEFAULT 0`.
- Migration: `migrations/add-client-organizer.sql` + column in `schema.sql`.

**Auth change** (`functions/_lib/auth.js`):
- An account is an organizer if `isOrganizerEmail(env, email)` (config bootstrap — **always** wins,
  cannot be revoked from the UI) **OR** `client.is_organizer === 1`.
- `currentOrganizer()` updated to select `is_organizer` and apply the OR.
- The `isOrganizer` flag returned by `/api/auth/session` and `/api/auth/verify` uses the same OR
  (these already query the client row; add `is_organizer` to the select).

**API:** new `functions/api/org/organizers.js`:
- `GET /api/org/organizers` → `{ configEmails: [...], members: [{ clientId, email, name,
  is_organizer, source: 'config'|'db', isSelf }] }`. Config emails listed as **permanent**.
- `POST /api/org/organizers { action }`:
  - `grant` — `{ email }` or `{ clientId }`: set `is_organizer=1` on an existing client.
  - `revoke` — `{ clientId }`: set `is_organizer=0`. **Guards:** reject if the target is a config
    organizer (their access persists regardless) or is the acting organizer (no self-revoke).
  - `invite` — `{ email, name? }`: `INSERT OR IGNORE` a client row, set `is_organizer=1`, and email
    them a magic-link sign-in (reuses the token mint + `sendMagicLink` from the auth flow).
- **Authorization:** any organizer may manage organizers (no super-admin tier — YAGNI).

**Magic-link mint reuse:** factor the token mint currently inline in `functions/api/auth/request.js`
into a small helper (e.g. `issueMagicLink(env, client, site)` in `_lib/auth.js` or a shared module)
so both `request.js` and the `invite` action use it without duplication.

**Frontend:** new page `src/pages/OrgTeam.jsx`, route `/org/team`:
- Current organizers list: config entries badged "Permanent (config)"; DB members with a Revoke
  control (hidden for self + config). 
- Invite-by-email form (email + optional name) → sends the invite.
- `src/lib/api.js`: `orgOrganizers()` (GET) and `orgOrganizerAction(payload)` (POST).

**Out of scope:** role tiers/permissions beyond organizer, audit log, removing config organizers.

---

## Testing

- **Pure helpers** (`scripts/test-money.mjs`): `slugify()` (basic + collision-irrelevant string
  cases) and an `isOrganizer` resolution helper (config-only, db-only, both, neither).
- **Manual/live verification per feature** after deploy: organizer-gated endpoints return 403 when
  unauthenticated (curl), and the new page round-trips a create/reply/grant.

## Risks & mitigations

- **Self-lockout from organizer revoke** → config bootstrap always grants access; revoke guards
  block self + config targets.
- **Invite emails depend on Resend** → already live; `invite` still creates the row if email no-ops,
  and surfaces the send result.
- **Slug collisions on vendor create** → suffix loop ensures uniqueness against existing slugs.
- **Migrations on live D1** → additive, nullable/defaulted columns. `ALTER ... ADD COLUMN` is **not**
  idempotent (it errors if the column already exists), so each migration file is applied exactly once
  and recorded in the commit that adds it.

## Delivery order

1. **Vendors** (no migration) → deploy → review.
2. **Messages** (`messages` ALTER) → migrate → deploy → review.
3. **Organizers** (`clients` ALTER + auth change) → migrate → deploy → review.
