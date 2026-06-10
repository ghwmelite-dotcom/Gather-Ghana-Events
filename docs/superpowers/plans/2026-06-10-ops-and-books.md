# Organizer Ops & Books Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give organizers an operations backbone — team tasks, per-event expenses/budgets, a cross-event books view with CSV export, and an activity trail.

**Architecture:** Mirrors the proven org-admin pattern: one D1 table + one organizer-gated Pages Function action API + one React page per feature, plus per-event panels on `OrgClient.jsx`. Pure money math lives in `functions/_lib/books.js` and is unit-tested via `scripts/test-money.mjs`.

**Tech Stack:** React/Vite/Tailwind, Cloudflare Pages Functions, D1 (SQLite), node test script.

**Spec:** `docs/superpowers/specs/2026-06-10-ops-and-books-design.md`

---

### Task 1: Schema — four new tables

**Files:** Modify: `schema.sql` (append)

- [ ] Append `tasks`, `expenses`, `activity_log` tables exactly as written in the spec (IF NOT EXISTS, with indexes) under a new `-- Organizer Ops & Books` banner.
- [ ] Apply locally is N/A (no local D1 in this repo's loop); applied `--remote` at deploy (Task 9).
- [ ] Commit: `Schema: tasks, expenses, activity_log tables`

### Task 2: Pure logic — books math + CSV (TDD)

**Files:** Create: `functions/_lib/books.js` · Modify: `scripts/test-money.mjs`

- [ ] Add failing tests to `scripts/test-money.mjs`:

```js
console.log('books')
t('expenseTotals', () => assert.deepEqual(
  expenseTotals([
    { status: 'planned', amount: 100 }, { status: 'committed', amount: 200 },
    { status: 'paid', amount: 300 }, { status: 'paid', amount: 50 },
  ]),
  { planned: 100, committed: 200, paid: 350, total: 650 }
))
t('expenseTotals empty', () => assert.deepEqual(expenseTotals([]), { planned: 0, committed: 0, paid: 0, total: 0 }))
t('bookSummary', () => assert.deepEqual(
  bookSummary({ estimateMinor: 1000, collectedMinor: 400, expenses: [
    { status: 'paid', amount: 150 }, { status: 'planned', amount: 250 },
  ] }),
  { estimate: 1000, collected: 400, outstanding: 600, costs: { planned: 250, committed: 0, paid: 150, total: 400 },
    projectedMargin: 600, actualMargin: 250 }
))
t('bookSummary overspend clamps nothing', () => assert.equal(
  bookSummary({ estimateMinor: 100, collectedMinor: 0, expenses: [{ status: 'paid', amount: 300 }] }).projectedMargin, -200
))
t('toCsv escaping', () => assert.equal(
  toCsv(['a', 'b'], [['x,y', 'he said "hi"'], ['line\nbreak', 7]]),
  'a,b\r\n"x,y","he said ""hi"""\r\n"line\nbreak",7'
))
```

- [ ] Run `node scripts/test-money.mjs` → FAIL (module missing).
- [ ] Implement `functions/_lib/books.js`: `expenseTotals(expenses)`, `bookSummary({estimateMinor, collectedMinor, expenses})` (outstanding = max(0, estimate − collected); projectedMargin = estimate − total costs; actualMargin = collected − paid costs), `toCsv(headers, rows)` (quote any cell containing `[",\n\r]`, double quotes, CRLF row sep).
- [ ] Run tests → all pass. Commit: `Books: pure expense/margin/CSV logic + tests`

### Task 3: Activity helper + instrumentation

**Files:** Create: `functions/_lib/activity.js` · Modify: `functions/api/org/inquiry.js`, `functions/api/org/milestones.js`, `functions/api/org/proposals.js`, `functions/api/org/vendors.js`, `functions/api/org/organizers.js`, `functions/api/org/messages.js`, `functions/api/portal/milestones.js`, `functions/api/portal/proposals.js`, `functions/_lib/reconcile.js`

- [ ] `activity.js`: `logActivity(db, { actor, action, entityType, entityId, inquiryId, detail })` — INSERT inside try/catch (never throws), `uid('act_')`, `now()`.
- [ ] Instrument each endpoint after its successful mutation with a one-line human `detail` (e.g. `Status → booked for Ama`, `Funded "Vendor confirmations" (GH₵ 5,000)`); actor = organizer/client email, `paystack` in reconcile success path.
- [ ] Commit: `Activity log: helper + instrument org/portal/payment mutations`

### Task 4: Tasks API + Expenses API + Activity API

**Files:** Create: `functions/api/org/tasks.js`, `functions/api/org/expenses.js`, `functions/api/org/activity.js`

- [ ] `tasks.js` — GET `?inquiry=` → `{ tasks, team, inquiries }` (tasks LEFT JOIN inquiries+clients for `client_name`/`event_type`; team via the organizers.js member query; inquiries as `{id, label}` from latest 100). POST `create|update|set_status|delete` (statuses `open|in_progress|done`; `set_status` to done stamps `completed_at`, otherwise nulls it). All inputs through `clampStr`; organizer-gated; `logActivity` on create/status/delete.
- [ ] `expenses.js` — GET `?inquiry=` → `{ expenses, categories, inquiries }`. POST `create|update|set_status|delete`; GH₵ → `toMinor`; `paid` stamps `paid_at`; CATEGORIES = venue catering decor photography music rentals transport staffing fees misc; `logActivity` on create/status/delete.
- [ ] `activity.js` — GET `?inquiry=&limit=` (default 40, max 100) ordered `created_at DESC`.
- [ ] Commit: `Org APIs: tasks, expenses, activity`

### Task 5: Books API (rollups + CSV export)

**Files:** Create: `functions/api/org/books.js`

- [ ] GET (no params) → per-inquiry rollup: estimate `toMinor`(whole-cedi legacy), collected = SUM payments success, costs via `expenseTotals`, margins via `bookSummary`; `totals` across events + general (NULL-inquiry) expenses + escrow held. One query per table, joined in JS (D1-friendly).
- [ ] GET `?export=events|payments|expenses` → `toCsv` output with `Content-Type: text/csv` + `Content-Disposition: attachment; filename="gge-<export>-<yyyymmdd>.csv"`. Amounts exported in GH₵ (fromMinor) for spreadsheet use.
- [ ] Commit: `Books API: per-event money rollup + CSV exports`

### Task 6: Overview + client-detail API additions

**Files:** Modify: `functions/api/org/overview.js`, `functions/api/org/clients/[id].js`

- [ ] overview: add `activity` (latest 12) and stats `openTasks`, `expensesPaid` (SUM paid) to the Promise.all.
- [ ] clients/[id]: add `tasks`, `expenses`, `activity` (latest 15 for the inquiry) to the response.
- [ ] Commit: `Org overview/client APIs: tasks, expenses, activity data`

### Task 7: Frontend — api client, routes, pages, panels

**Files:** Modify: `src/lib/api.js`, `src/main.jsx`, `src/pages/OrgDashboard.jsx`, `src/pages/OrgClient.jsx` · Create: `src/pages/OrgTasks.jsx`, `src/pages/OrgBooks.jsx`

- [ ] api.js: `orgTasks(query)`, `orgTaskAction`, `orgExpenses(query)`, `orgExpenseAction`, `orgBooks()`, `orgActivity(query)`.
- [ ] main.jsx: ProtectedRoute routes `/org/tasks`, `/org/books`.
- [ ] OrgDashboard: nav links Tasks + Books; "Recent activity" card (detail + actor + relative date) under Recent messages.
- [ ] OrgTasks.jsx: status filter chips, assignee select, add form (title/due/assignee/event), rows with status cycle (open → in progress → done), overdue due-dates in terracotta, event chip linking to `/org/clients/:id`. Follows OrgVendors layout/state pattern (loading/forbidden/error states identical).
- [ ] OrgBooks.jsx: 4 stat cards (Collected, Outstanding, Spent, Margin), per-event books table, expense manager (add/edit/advance status/delete, event select), export `<a>` buttons to `/api/org/books?export=…`.
- [ ] OrgClient.jsx: "Tasks" card and "Budget & costs" card (uses `tasks`/`expenses` from the client API; quick-add posts then reloads; money panel gains Spent + Margin lines); "Recent activity" list at the bottom of right column.
- [ ] Commit: `Org UI: tasks board, books page, client ops panels, dashboard activity`

### Task 8: Guide + verification

**Files:** Modify: `src/lib/guide.js` · run `npm run build`, `node scripts/test-money.mjs`

- [ ] Add organizer guide entries: "Assign tasks to your team", "Track costs & margins (Books)", note on the activity trail and CSV export.
- [ ] `node scripts/test-money.mjs` → all pass; `npm run build` → clean.
- [ ] Commit: `Guide: tasks, books & activity how-tos`

### Task 9: Deploy

- [ ] `wrangler d1 execute gather-ghana --file=./schema.sql --remote` (additive, safe).
- [ ] `npm run build` + `wrangler pages deploy` per deploy-credentials memory; push to GitHub.
- [ ] Smoke-check `/org/tasks`, `/org/books` on production.
