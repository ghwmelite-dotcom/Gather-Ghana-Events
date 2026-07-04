# Read-only Viewer Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only "viewer" organizer role so invited testers can view every `/org` page but cannot perform any write, enforced on the backend.

**Architecture:** A new `role` column on `clients` (`'admin'` | `'viewer'`) distinguishes writers from viewers among organizers. Backend adds `roleOf`/`canWrite` helpers and a `currentEditor` guard that every write endpoint uses (reads keep `currentOrganizer`). The signed-in client object gains `role` + `canWrite`, which the SPA uses to show a read-only banner and disable primary write buttons. The Team screen assigns roles at invite time and toggles them after.

**Tech Stack:** Cloudflare Pages Functions (JS), D1 (SQLite), React SPA (Vite), Resend email. No Worker test runner exists — pure helpers get a standalone Node assertion script (`node scripts/...`); endpoints and UI get a documented manual verification pass after deploy.

**Spec:** `docs/superpowers/specs/2026-07-04-viewer-role-design.md`

**Branch:** Create `feat/viewer-role` off `main` before Task 1.

---

## File Structure

- `schema.sql` — add `role` column to `CREATE TABLE clients` (modify).
- `functions/_lib/auth.js` — add `roleOf`, `canWrite`, `currentEditor`; extend `currentOrganizer` SELECT (modify).
- `functions/api/org/*.js` — every `onRequestPost` swaps `currentOrganizer` → `currentEditor` (modify: expenses, inquiry, messages, milestones, organizers, proposals, tasks, thread, vendors).
- `functions/api/org/organizers.js` — store `role` on invite/grant, add `setRole` action, return `role` per member (modify).
- `functions/api/auth/session.js`, `functions/api/auth/verify.js` — add `role` + `canWrite` to returned client (modify).
- `scripts/test-viewer-role.mjs` — Node assertions for `roleOf`/`canWrite` (create).
- `src/components/ReadOnlyBanner.jsx` — banner shown to viewers (create).
- `src/components/ProtectedRoute.jsx` — render banner on `/org` for viewers (modify).
- `src/lib/api.js` — add `role` param passthrough is automatic (payloads), no signature change needed; add nothing new (invite/grant/setRole all go through `orgOrganizerAction`).
- `src/pages/Org*.jsx` — disable primary write buttons via `useAuth().client.canWrite` (modify: OrgTeam, OrgTasks, OrgVendors, OrgMessages, OrgClient, OrgBooks, OrgDashboard).
- `src/pages/OrgTeam.jsx` — role dropdown on invite, role badge + toggle per member (modify).

---

### Task 1: Add `role` column to schema

**Files:**
- Modify: `schema.sql:7-14`

- [ ] **Step 1: Add the column to the clients table definition**

In `schema.sql`, change the `clients` table so it reads:

```sql
CREATE TABLE IF NOT EXISTS clients (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  phone        TEXT,
  is_organizer INTEGER NOT NULL DEFAULT 0,
  role         TEXT NOT NULL DEFAULT 'admin',   -- 'admin' | 'viewer' (only meaningful when is_organizer = 1)
  created_at   INTEGER NOT NULL
);
```

- [ ] **Step 2: Commit**

```bash
git add schema.sql
git commit -m "feat(schema): add clients.role for viewer role"
```

Note: the live D1 migration (`ALTER TABLE`) is run in Task 8, not here — schema.sql only governs fresh databases.

---

### Task 2: Backend auth helpers + `currentEditor`

**Files:**
- Modify: `functions/_lib/auth.js:82-106`
- Create: `scripts/test-viewer-role.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-viewer-role.mjs`:

```js
// Standalone assertions for role helpers (no D1). Run: node scripts/test-viewer-role.mjs
import assert from 'node:assert/strict'
import { roleOf, canWrite } from '../functions/_lib/auth.js'

const env = { ORGANIZER_EMAILS: 'boss@acme.com' }

// Config admin is always admin, even if the row says viewer.
assert.equal(roleOf(env, { email: 'boss@acme.com', role: 'viewer', is_organizer: 1 }), 'admin')
assert.equal(canWrite(env, { email: 'boss@acme.com', role: 'viewer', is_organizer: 1 }), true)

// DB admin can write.
assert.equal(roleOf(env, { email: 'a@acme.com', role: 'admin', is_organizer: 1 }), 'admin')
assert.equal(canWrite(env, { email: 'a@acme.com', role: 'admin', is_organizer: 1 }), true)

// DB viewer cannot write.
assert.equal(roleOf(env, { email: 'v@acme.com', role: 'viewer', is_organizer: 1 }), 'viewer')
assert.equal(canWrite(env, { email: 'v@acme.com', role: 'viewer', is_organizer: 1 }), false)

// Missing role defaults to admin (existing rows before migration read null → treat as admin).
assert.equal(roleOf(env, { email: 'a@acme.com', role: null, is_organizer: 1 }), 'admin')

// Non-organizer can never write.
assert.equal(canWrite(env, { email: 'x@acme.com', role: 'admin', is_organizer: 0 }), false)

console.log('OK: role helper assertions passed')
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/test-viewer-role.mjs`
Expected: FAIL — `SyntaxError`/`does not provide an export named 'roleOf'` (helpers not defined yet).

- [ ] **Step 3: Implement the helpers**

In `functions/_lib/auth.js`, after the existing `isOrganizer` function (ends at line 86), add:

```js
/** Effective role for an organizer: config admins are always 'admin'; else the DB role. */
export function roleOf(env, client) {
  if (!client) return 'viewer'
  if (isOrganizerEmail(env, client.email)) return 'admin'
  return client.role === 'viewer' ? 'viewer' : 'admin'
}

/** Can this client perform write actions in /org? Organizer AND not a viewer. */
export function canWrite(env, client) {
  return isOrganizer(env, client) && roleOf(env, client) !== 'viewer'
}
```

- [ ] **Step 4: Extend `currentOrganizer` to load `role`, add `currentEditor`**

In `functions/_lib/auth.js`, replace the `currentOrganizer` function (lines 99-106) with:

```js
/** Resolve the signed-in organizer (id, email, name, role), or null if not an organizer. */
export async function currentOrganizer(request, env) {
  const clientId = await currentClientId(request, env)
  if (!clientId) return null
  const client = await env.DB.prepare('SELECT id, email, name, is_organizer, role FROM clients WHERE id = ?').bind(clientId).first()
  if (!client || !isOrganizer(env, client)) return null
  return client
}

/** Resolve the signed-in organizer only if they may write (not a viewer); else null. */
export async function currentEditor(request, env) {
  const org = await currentOrganizer(request, env)
  if (!org || !canWrite(env, org)) return null
  return org
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node scripts/test-viewer-role.mjs`
Expected: PASS — `OK: role helper assertions passed`

- [ ] **Step 6: Commit**

```bash
git add functions/_lib/auth.js scripts/test-viewer-role.mjs
git commit -m "feat(auth): roleOf/canWrite helpers and currentEditor guard"
```

---

### Task 3: Enforce `currentEditor` on all org write endpoints

**Files (each: swap the guard in `onRequestPost` only):**
- Modify: `functions/api/org/expenses.js:45-46`
- Modify: `functions/api/org/inquiry.js:10-11`
- Modify: `functions/api/org/messages.js:37-38`
- Modify: `functions/api/org/milestones.js:15-16`
- Modify: `functions/api/org/proposals.js:11-12`
- Modify: `functions/api/org/tasks.js:47-49`
- Modify: `functions/api/org/thread.js:32-33`
- Modify: `functions/api/org/vendors.js:38-39`
- (organizers.js is handled in Task 5.)

- [ ] **Step 1: Update each file's import and POST guard**

For **each** file above, in the import line change `currentOrganizer` to also import `currentEditor`, e.g. in `functions/api/org/tasks.js:7`:

```js
import { currentOrganizer, currentEditor, isOrganizerEmail } from '../../_lib/auth.js'
```

(For files that only import `currentOrganizer`, e.g. `expenses.js:8`, change to `import { currentOrganizer, currentEditor } from '../../_lib/auth.js'`.)

Then inside `onRequestPost`, replace the two guard lines:

```js
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
```

with:

```js
  const org = await currentEditor(request, env)
  if (!org) return fail("Read-only access — this action isn't available.", 403)
```

Leave every `onRequestGet` guard as `currentOrganizer` (viewers must still read).

- [ ] **Step 2: Verify no write POST still uses `currentOrganizer`**

Run: `grep -rn "currentOrganizer" functions/api/org`
Expected: matches appear ONLY inside `onRequestGet` handlers (reads). No `onRequestPost` in expenses/inquiry/messages/milestones/proposals/tasks/thread/vendors should reference `currentOrganizer`.

- [ ] **Step 3: Verify every editor import resolves**

Run: `grep -rn "currentEditor" functions/api/org`
Expected: one import + one use per modified file.

- [ ] **Step 4: Commit**

```bash
git add functions/api/org/expenses.js functions/api/org/inquiry.js functions/api/org/messages.js functions/api/org/milestones.js functions/api/org/proposals.js functions/api/org/tasks.js functions/api/org/thread.js functions/api/org/vendors.js
git commit -m "feat(org): block viewers from all write endpoints"
```

---

### Task 4: Surface `role` + `canWrite` in the session identity

**Files:**
- Modify: `functions/api/auth/session.js:4,10-16`
- Modify: `functions/api/auth/verify.js:6,26-40`

- [ ] **Step 1: Update `session.js`**

Change the import (line 4) to:

```js
import { currentClientId, isOrganizer, roleOf, canWrite } from '../../_lib/auth.js'
```

Change the SELECT (line 11) to include `role`:

```js
    .prepare('SELECT id, email, name, is_organizer, role FROM clients WHERE id = ?')
```

Change the returned client (line 16) to:

```js
  return json({ ok: true, client: { id: client.id, email: client.email, name: client.name, isOrganizer: isOrganizer(env, client), role: roleOf(env, client), canWrite: canWrite(env, client) } })
```

- [ ] **Step 2: Update `verify.js`**

Change the import (line 6) to:

```js
import { createSession, sessionCookie, isOrganizer, roleOf, canWrite } from '../../_lib/auth.js'
```

Change the SELECT (line 27) to include `role`:

```js
    .prepare('SELECT id, email, name, is_organizer, role FROM clients WHERE id = ?')
```

Change the returned client in the `json(...)` body (line 37) to:

```js
    { ok: true, client: { id: client.id, email: client.email, name: client.name, isOrganizer: isOrganizer(env, client), role: roleOf(env, client), canWrite: canWrite(env, client) } },
```

- [ ] **Step 3: Commit**

```bash
git add functions/api/auth/session.js functions/api/auth/verify.js
git commit -m "feat(auth): expose role and canWrite on the session client"
```

---

### Task 5: Team API — role on invite/grant + `setRole`

**Files:**
- Modify: `functions/api/org/organizers.js`

- [ ] **Step 1: Switch writes to `currentEditor` and import helpers**

Change the import (line 8) to:

```js
import { currentOrganizer, currentEditor, isOrganizerEmail, issueMagicLink, roleOf } from '../../_lib/auth.js'
```

In `onRequestPost` (lines 34-35), replace the guard with:

```js
  const org = await currentEditor(request, env)
  if (!org) return fail("Read-only access — this action isn't available.", 403)
```

(Keep `onRequestGet` on `currentOrganizer`.)

- [ ] **Step 2: Return each member's role in GET**

In `onRequestGet`, change the SELECT (line 22) to include `role`:

```js
    .prepare(`SELECT id, email, name, is_organizer, role FROM clients WHERE ${where} ORDER BY name`)
```

And change the members map (lines 25-29) to include role:

```js
  const members = results.map((c) => ({
    clientId: c.id, email: c.email, name: c.name,
    role: roleOf(env, c),
    source: isOrganizerEmail(env, c.email) ? 'config' : 'db',
    isSelf: c.id === org.id,
  }))
```

- [ ] **Step 3: Accept `role` on `grant`**

In the `grant` block, after `UPDATE clients SET is_organizer = 1 ...` (line 48), set the role from the request (default admin). Replace line 48 with:

```js
    const role = body.role === 'viewer' ? 'viewer' : 'admin'
    await db.prepare('UPDATE clients SET is_organizer = 1, role = ? WHERE id = ?').bind(role, client.id).run()
```

- [ ] **Step 4: Accept `role` on `invite`**

In the `invite` block, compute the role once and store it on both branches. Replace lines 68-76 with:

```js
    const role = body.role === 'viewer' ? 'viewer' : 'admin'
    let client = await db.prepare('SELECT id FROM clients WHERE email = ?').bind(email).first()
    if (client) {
      await db.prepare('UPDATE clients SET is_organizer = 1, role = ? WHERE id = ?').bind(role, client.id).run()
    } else {
      const id = uid('cl_')
      await db.prepare('INSERT INTO clients (id, email, name, is_organizer, role, created_at) VALUES (?,?,?,1,?,?)')
        .bind(id, email, name, role, now()).run()
      client = { id }
    }
```

- [ ] **Step 5: Add the `setRole` action**

Immediately before the final `return fail('Unknown action', 422)` (line 84), add:

```js
  if (action === 'setRole') {
    const id = clampStr(body.clientId, 60)
    const role = body.role === 'viewer' ? 'viewer' : 'admin'
    const client = await db.prepare('SELECT id, email FROM clients WHERE id = ?').bind(id).first()
    if (!client) return fail('Client not found', 404)
    if (client.id === org.id) return fail('You cannot change your own role', 409)
    if (isOrganizerEmail(env, client.email)) return fail('This organizer is set in config and cannot be changed here', 409)
    await db.prepare('UPDATE clients SET role = ? WHERE id = ?').bind(role, id).run()
    await logActivity(db, { actor: org.email, action: 'team.setRole', entityType: 'client', entityId: id, detail: `Set ${client.email} to ${role}` })
    return ok({ clientId: id, role })
  }
```

- [ ] **Step 6: Verify the file parses**

Run: `node --check functions/api/org/organizers.js`
Expected: no output (valid syntax).

- [ ] **Step 7: Commit**

```bash
git add functions/api/org/organizers.js
git commit -m "feat(team): assign viewer/admin role on invite/grant and via setRole"
```

---

### Task 6: Read-only banner + primary-button disabling

**Files:**
- Create: `src/components/ReadOnlyBanner.jsx`
- Modify: `src/components/ProtectedRoute.jsx`

- [ ] **Step 1: Create the banner component**

Create `src/components/ReadOnlyBanner.jsx`:

```jsx
import { Lock } from '../lib/icons.jsx'

/** Slim notice shown to organizer viewers who cannot make changes. */
export default function ReadOnlyBanner() {
  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-plum text-cream text-sm px-4 py-2"
    >
      <Lock size={14} className="text-champagne-light" />
      You have read-only access — changes are disabled.
    </div>
  )
}
```

- [ ] **Step 2: Render it for viewers on `/org` routes**

In `src/components/ProtectedRoute.jsx`, import the banner and show it when a signed-in client lacks write access on an `/org` path. Replace the whole file with:

```jsx
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'
import { Spinner } from '../lib/icons.jsx'
import ReadOnlyBanner from './ReadOnlyBanner.jsx'

/** Gates portal routes. Shows a loader while the session resolves. */
export default function ProtectedRoute({ children }) {
  const { client, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center text-plum">
        <Spinner size={32} />
      </div>
    )
  }
  if (!client) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  const readOnly = location.pathname.startsWith('/org') && client.canWrite === false
  return (
    <>
      {readOnly && <ReadOnlyBanner />}
      {children}
    </>
  )
}
```

- [ ] **Step 3: Build to verify no import/JSX errors**

Run: `npm run build`
Expected: build succeeds (exit 0).

- [ ] **Step 4: Commit**

```bash
git add src/components/ReadOnlyBanner.jsx src/components/ProtectedRoute.jsx
git commit -m "feat(org): read-only banner for viewer role"
```

---

### Task 7: Disable primary write controls per org page

Each org page reads `canWrite` from auth and disables its primary write control(s). The pattern for every page:

```jsx
import { useAuth } from '../lib/AuthContext.jsx'
// inside the component:
const { client } = useAuth()
const canWrite = client?.canWrite !== false
```

Then add `disabled={!canWrite}` (combined with any existing `disabled`/`busy` condition using `||`) to that page's primary action button(s).

**Files + the control(s) to disable:**
- `src/pages/OrgTeam.jsx` — the **"Send invite"** `Button` (line 86) and each member **Revoke** button (line 70). (Role dropdown/toggle come in Task 7b below — keep them enabled only for writers.)
- `src/pages/OrgTasks.jsx` — the primary **add/create task** button and any inline status/delete controls.
- `src/pages/OrgVendors.jsx` — the **add vendor / save** button.
- `src/pages/OrgMessages.jsx` — the **reply/send** button.
- `src/pages/OrgClient.jsx` — proposal/milestone/status **action** buttons and the **thread send** button.
- `src/pages/OrgBooks.jsx` — any **expense/entry add** button (Books is largely read; disable any write control present).
- `src/pages/OrgDashboard.jsx` — any inquiry **status-change** control.

- [ ] **Step 1: For each file above, wire `canWrite` and disable its write button(s)**

In each file: add the `useAuth`/`canWrite` lines shown above (if `useAuth` is already imported, reuse it), then set `disabled={!canWrite || <existing condition>}` on each named control. Example for `OrgTeam.jsx` line 86:

```jsx
<Button onClick={sendInvite} disabled={!canWrite || !invite.email || busy} variant="primary" size="sm"><Plus size={16} /> Send invite</Button>
```

And the Revoke button (line 70):

```jsx
<button aria-label={`Revoke organizer access for ${m.name}`} disabled={busy || !canWrite} onClick={() => revoke(m)} className="text-xs rounded-full border border-terracotta/30 px-3 py-1.5 text-terracotta disabled:opacity-50">Revoke</button>
```

- [ ] **Step 2: Grep to confirm each page references canWrite**

Run: `grep -rln "canWrite" src/pages/Org*.jsx`
Expected: all seven Org*.jsx files listed.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds (exit 0).

- [ ] **Step 4: Commit**

```bash
git add src/pages/OrgTeam.jsx src/pages/OrgTasks.jsx src/pages/OrgVendors.jsx src/pages/OrgMessages.jsx src/pages/OrgClient.jsx src/pages/OrgBooks.jsx src/pages/OrgDashboard.jsx
git commit -m "feat(org): disable write controls for viewers"
```

---

### Task 7b: Team screen role dropdown + role badge/toggle

**Files:**
- Modify: `src/pages/OrgTeam.jsx`

- [ ] **Step 1: Add role state and dropdown to the invite form**

In `OrgTeam.jsx`, extend the invite state (line 13) to carry a role:

```jsx
  const [invite, setInvite] = useState({ email: '', name: '', role: 'admin' })
```

In `sendInvite` (lines 25-32), pass the role:

```jsx
      const res = await api.orgOrganizerAction({ action: 'invite', email, name, role: invite.role })
```

and reset it after success:

```jsx
      setInvite({ email: '', name: '', role: 'admin' })
```

In the invite card (after the Name `Field`, line 85), add a native select:

```jsx
            <label className="block text-sm">
              <span className="text-ink/70">Access</span>
              <select
                value={invite.role}
                onChange={(e) => setInvite({ ...invite, role: e.target.value })}
                className="mt-1 w-full rounded-xl border border-plum/15 bg-cream px-3 py-2 text-plum"
              >
                <option value="admin">Admin — full access</option>
                <option value="viewer">Viewer — read-only</option>
              </select>
            </label>
```

- [ ] **Step 2: Add a role helper for member rows**

Add a `setRole` handler next to `revoke` (after line 33):

```jsx
  const setRole = (m, role) => run(() => api.orgOrganizerAction({ action: 'setRole', clientId: m.clientId, role }))
```

- [ ] **Step 3: Show the role badge + toggle on each member row**

In the member row (lines 62-72), inside the right-hand controls, show the role and a toggle for db members who aren't you. Replace the trailing conditional block (lines 67-71) with:

```jsx
                {m.source === 'config' ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-plum/10 text-ink/55">Permanent (config)</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-plum/10 text-ink/60">{m.role === 'viewer' ? 'Viewer' : 'Admin'}</span>
                    {!m.isSelf && (
                      <>
                        <button disabled={busy || !canWrite} onClick={() => setRole(m, m.role === 'viewer' ? 'admin' : 'viewer')} className="text-xs rounded-full border border-plum/20 px-3 py-1.5 text-plum disabled:opacity-50">
                          {m.role === 'viewer' ? 'Make admin' : 'Make viewer'}
                        </button>
                        <button aria-label={`Revoke organizer access for ${m.name}`} disabled={busy || !canWrite} onClick={() => revoke(m)} className="text-xs rounded-full border border-terracotta/30 px-3 py-1.5 text-terracotta disabled:opacity-50">Revoke</button>
                      </>
                    )}
                  </div>
                )}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds (exit 0).

- [ ] **Step 5: Commit**

```bash
git add src/pages/OrgTeam.jsx
git commit -m "feat(team): role dropdown, badge, and admin/viewer toggle"
```

---

### Task 8: Live migration, deploy, and manual verification

**Files:** none (operational).

- [ ] **Step 1: Migrate the live D1**

Run:

```bash
npx wrangler d1 execute gather-ghana --remote --command "ALTER TABLE clients ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';"
```

Expected: success. (If it errors with "duplicate column name", the migration already ran — safe to continue.)

- [ ] **Step 2: Deploy the code**

Run the project's standard deploy:

```bash
npm run build && npx wrangler pages deploy
```

Expected: build succeeds and deploy reports a live URL.

- [ ] **Step 3: Manual verification (record results)**

1. As `ohwpstudios@gmail.com`, go to `/org/team` → **Invite** a test email with **Access = Viewer**.
2. Sign in as that viewer via the emailed link. Confirm:
   - The **"You have read-only access"** banner shows on `/org`.
   - Every page loads and data is visible.
   - Primary write buttons (add task, send reply, invite, etc.) are disabled.
3. As the viewer, in devtools console run a direct write and confirm `403`:
   ```js
   fetch('/api/org/tasks', {method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({action:'create', title:'x'})}).then(r=>r.status)
   ```
   Expected: `403`.
4. As the admin, use **Make admin** on that member; have them refresh. Confirm the banner disappears and writes now succeed.
5. Confirm a config admin (`ohwpstudios@gmail.com`) shows **Permanent (config)** with no role toggle and cannot be demoted.

- [ ] **Step 4: Finish the branch**

Use the `superpowers:finishing-a-development-branch` skill to merge `feat/viewer-role` or open a PR.

---

## Self-Review Notes

- **Spec coverage:** §1 data model → Task 1 (+ Task 8 migration); §2 helpers → Task 2; §3 enforcement → Tasks 3 & 5; §4 identity → Task 4; §5 frontend → Tasks 6 & 7; §6 team → Tasks 5 & 7b; §7 deploy → Task 8; testing → Task 2 (helpers) + Task 8 (manual). All covered.
- **Type/name consistency:** `roleOf`, `canWrite`, `currentEditor` defined in Task 2 and used identically in Tasks 3–5; `role` field name consistent across DB, API, session, and UI; `setRole` action name matches between `organizers.js` (Task 5) and `OrgTeam.jsx` (Task 7b); `client.canWrite` field used consistently in ProtectedRoute (Task 6) and pages (Task 7).
- **Config-admin invariant:** `roleOf` forces `'admin'` for `ORGANIZER_EMAILS`, and both `setRole` and `revoke` reject config emails — a permanent admin can never become a viewer.
