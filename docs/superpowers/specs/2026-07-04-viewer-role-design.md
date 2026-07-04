# Read-only viewer role — design

**Date:** 2026-07-04
**Status:** Approved (pending spec review)
**Author:** Org platform

## Problem

During the test phase, some invited teammates should be able to *view* the organizer
dashboard but not change anything. Today there is a single access level: any organizer
(`is_organizer = 1` or an email in `ORGANIZER_EMAILS`) has full read/write admin access.
We need a second, lesser role — **viewer** — that can read every `/org` screen but cannot
perform any write action.

## Goals

- A viewer can sign in and read every `/org` page exactly like an admin.
- A viewer cannot perform any write, enforced on the **backend** (not just hidden in the UI).
- Admins can assign the viewer role at invite time and flip an existing member between
  admin and viewer without re-inviting.
- The permanent config admins (`ORGANIZER_EMAILS`) are always admins and can never become
  viewers.

## Non-goals (YAGNI)

- Per-page or per-resource granular permissions.
- More than two roles (no "editor", no viewer sub-tiers).
- Auditing or restricting what data a viewer can *read*.
- Changing the portal (client-side) auth model — this is organizer-only.

## Design

### 1. Data model

Add one column to `clients`:

```sql
ALTER TABLE clients ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';  -- 'admin' | 'viewer'
```

- `role` is only meaningful when `is_organizer = 1`.
- Default `'admin'` means every existing organizer keeps full access — no behavior change.
- Config admins (`ORGANIZER_EMAILS`) are always treated as `admin` regardless of the column.

`schema.sql` is updated to include the column in the `CREATE TABLE clients` definition so
fresh databases match; the `ALTER TABLE` is applied to the existing live D1.

### 2. Backend auth helpers (`functions/_lib/auth.js`)

- `roleOf(env, client)` → `'admin'` if `isOrganizerEmail(env, client.email)`, otherwise
  `client.role || 'admin'`.
- `canWrite(env, client)` → `isOrganizer(env, client) && roleOf(env, client) !== 'viewer'`.
- `currentEditor(request, env)` → resolves the signed-in client like `currentOrganizer`,
  but returns `null` when the client is a viewer. Its `SELECT` must include `role`.
- `currentOrganizer` `SELECT` is extended to include `role` so read handlers and the
  identity surface can report it. `currentOrganizer` continues to admit viewers (they read).

### 3. Enforcement

Every write handler (`onRequestPost`) in `functions/api/org/*.js` swaps its guard from
`currentOrganizer` to `currentEditor`:

- activity.js (GET only — unchanged)
- books.js (GET only — unchanged)
- clients/[id].js (GET only — unchanged)
- expenses.js — POST → `currentEditor`
- inquiry.js — POST → `currentEditor`
- messages.js — POST → `currentEditor`
- milestones.js — POST → `currentEditor`
- organizers.js — POST (invite/grant/revoke/setRole) → `currentEditor`
- overview.js (GET only — unchanged)
- proposals.js — POST → `currentEditor`
- tasks.js — POST → `currentEditor`
- thread.js — POST → `currentEditor`
- vendors.js — POST → `currentEditor`

All GET handlers keep `currentOrganizer`. There are no PUT/PATCH/DELETE handlers, so POST
coverage is complete. A viewer attempting any write receives:

```
403 { ok: false, error: "Read-only access — this action isn't available." }
```

This is the security core: enforcement lives on the server, so a viewer cannot write even
by calling the API directly.

### 4. Identity surface

`functions/api/auth/session.js` and `functions/api/auth/verify.js` add two fields to the
returned client object:

```js
role: roleOf(env, client),      // 'admin' | 'viewer'
canWrite: canWrite(env, client) // boolean
```

These flow through `AuthContext` unchanged; the SPA reads `client.canWrite`.

### 5. Frontend (banner + disabled primary actions)

- A `ReadOnlyBanner` component renders on `/org` pages when `client && !client.canWrite`
  ("You have read-only access — changes are disabled.").
- The primary write button on each org page (Add / Create / Send / Invite) is rendered with
  `disabled={!canWrite}` (read from `useAuth()`).
- The API layer surfaces a 403 read-only error as a friendly toast/inline message as a
  defensive backstop, in case a write control is reached.

Frontend hiding is a UX nicety; correctness does not depend on it (see §3).

### 6. Team management (`OrgTeam.jsx` + `functions/api/org/organizers.js`)

- The invite form gains a role dropdown (**Admin** / **Viewer**), default **Admin**. The
  `invite` action accepts and stores the chosen `role` on the created/updated client row.
- The `grant` action accepts an optional `role` (default `admin`).
- A new `setRole` action updates an existing member's role. Guards mirror `revoke`:
  cannot change your own role, and cannot change a config (permanent) admin.
- Each member row shows a role badge and a **"Make viewer" / "Make admin"** toggle.

### 7. Deploy

This feature requires a deploy (unlike the invite feature):

1. Migrate live D1:
   `npx wrangler d1 execute gather-ghana --remote --command "ALTER TABLE clients ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';"`
2. Deploy code: `npx wrangler pages deploy` (project's standard manual deploy).

## Testing

The repo has no Worker test runner (only ad-hoc `scripts/*.mjs`). Verification plan:

- Add a small standalone check for `roleOf` / `canWrite` logic if practical.
- Manual end-to-end after deploy:
  1. Invite a teammate as **Viewer**; confirm they can sign in and read `/org`.
  2. Confirm every primary write button is disabled and the banner shows.
  3. Confirm a direct API POST (e.g. create task) returns 403 for the viewer.
  4. Flip them to **Admin** via the toggle; confirm writes now succeed.
  5. Confirm a config admin cannot be demoted to viewer.

## Rollback

Set an affected member back to `admin` via the toggle, or drop the feature by reverting the
code deploy. The `role` column can remain (defaulting to `admin` is harmless).
