# Organizer Ops & Books — Design

**Date:** 2026-06-10
**Status:** Approved (autonomous session; user asked to ensure the platform covers an
event manager's real pain points: team coordination, bookkeeping, and accurate tracking)

## Problem

A prospective client (an event manager) is overwhelmed by manual record-keeping:
coordinating her team, keeping the books, and tracking everything per event. The
platform today is strong on **bookings and payments** (inquiry → proposal → booked →
milestones/escrow → Paystack) but has no **operations backbone**:

- No way to assign work to team members (Team page only grants access).
- No expense tracking, budgets, or margins — revenue is tracked, costs are not.
- No cross-event financial view and no exports for her books.
- No activity trail — nobody can see who did what, when.

## Approaches considered

1. **Weave ops into existing pages only** (tasks on client page, expenses on client
   page, no new routes). Least new surface, but no cross-event view — her core
   complaint is "tracking everything", which needs rollups.
2. **New `/org/tasks` + `/org/books` pages + per-event panels + activity log**
   (recommended). Follows the proven org-admin pattern (page + single action API per
   feature), gives both per-event and across-events views, CSV exports for books.
3. **Full accounting module** (invoices, double-entry, vendor payouts). Overkill —
   Paystack payouts aren't live, and YAGNI until she's on the platform.

**Chosen: approach 2.**

## Feature 1 — Tasks (team workboard)

**Schema** (additive in `schema.sql`):

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id             TEXT PRIMARY KEY,
  inquiry_id     TEXT REFERENCES inquiries(id) ON DELETE CASCADE,  -- NULL = general task
  title          TEXT NOT NULL,
  notes          TEXT,
  assignee_email TEXT,                                  -- a team member (or unassigned)
  due_date       TEXT,
  status         TEXT NOT NULL DEFAULT 'open',          -- open | in_progress | done
  created_by     TEXT,
  completed_at   INTEGER,
  created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_inquiry ON tasks(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status  ON tasks(status);
```

**API `/api/org/tasks`** (organizer-gated, same shape as vendors.js):
- `GET [?inquiry=<id>]` → `{ tasks, team, inquiries }`. Tasks join client name +
  event type for display. `team` = organizer members (same query as organizers.js)
  for the assignee dropdown. `inquiries` = `{id, label}` list for linking a task to
  an event.
- `POST { action }` → `create | update | set_status | delete`. `set_status` to
  `done` stamps `completed_at` (clears it otherwise).

**UI:**
- `/org/tasks` (`OrgTasks.jsx`): filter chips (All / Open / In progress / Done),
  assignee filter (Everyone / Mine / per member), task rows with status cycle
  button, assignee + due date (overdue in terracotta), linked-event chip → client
  page; add form (title, due, assignee, optional event).
- `OrgClient.jsx`: "Tasks" card for that inquiry with quick add + status toggle.

## Feature 2 — Expenses (the cost side of the books)

**Schema:**

```sql
CREATE TABLE IF NOT EXISTS expenses (
  id          TEXT PRIMARY KEY,
  inquiry_id  TEXT REFERENCES inquiries(id) ON DELETE CASCADE,  -- NULL = general/overhead
  vendor_name TEXT,
  category    TEXT NOT NULL DEFAULT 'misc',
  description TEXT,
  amount      INTEGER NOT NULL,                 -- minor units (pesewas)
  currency    TEXT NOT NULL DEFAULT 'GHS',
  status      TEXT NOT NULL DEFAULT 'planned',  -- planned | committed | paid
  paid_at     INTEGER,
  receipt_url TEXT,
  created_by  TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_expenses_inquiry ON expenses(inquiry_id);
```

Categories (suggested list, not enforced beyond clamp): venue, catering, decor,
photography, music, rentals, transport, staffing, fees, misc.
Lifecycle: **planned** (budget line) → **committed** (vendor booked) → **paid**
(stamps `paid_at`). The set of planned+committed lines IS the event budget — no
separate budget column, no migration of legacy `inquiries` columns.

**API `/api/org/expenses`:** `GET [?inquiry=]` → `{ expenses, categories, inquiries }`;
`POST` → `create | update | set_status | delete`. GH₵ input converted with `toMinor`.

**UI:** "Budget & costs" card on `OrgClient.jsx` (per-event lines, totals by status,
projected margin = estimate − all costs, actual margin = collected − paid costs);
full expense table with add/edit on `/org/books`.

## Feature 3 — Books (`/org/books`, cross-event money + CSV export)

**Pure logic** in `functions/_lib/books.js` (unit-tested like money/escrow):
- `expenseTotals(expenses)` → `{ planned, committed, paid, total }` (success-status
  agnostic summing by status).
- `bookSummary({ estimateMinor, collectedMinor, expenses })` → `{ outstanding,
  projectedMargin, actualMargin, ... }`.
- `toCsv(headers, rows)` — RFC-4180-style escaping (quotes, commas, newlines).

**API `/api/org/books`:**
- `GET` → `{ totals, events }`. Per inquiry: estimate (converted to minor units —
  legacy column is whole cedis), collected (successful payments), costs by status,
  margins. Totals across all events + general expenses + escrow held.
- `GET ?export=events|payments|expenses` → `text/csv` attachment (cookie-auth'd
  same-origin link, so plain `<a href>` works). This is "her books" in a file —
  openable in Excel/Sheets.

**UI `OrgBooks.jsx`:** 4 stat cards (Collected, Outstanding, Spent, Margin),
per-event books table (margin colored), all-expenses manager, export buttons.

## Feature 4 — Activity log (the accurate trail)

**Schema:**

```sql
CREATE TABLE IF NOT EXISTS activity_log (
  id          TEXT PRIMARY KEY,
  actor_email TEXT,
  action      TEXT NOT NULL,        -- e.g. inquiry.status, task.create, expense.paid
  entity_type TEXT,
  entity_id   TEXT,
  inquiry_id  TEXT,                 -- when related to a client/event, for filtering
  detail      TEXT,                 -- human-readable summary line
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_inquiry ON activity_log(inquiry_id);
```

**Helper** `functions/_lib/activity.js`: `logActivity(db, entry)` — best-effort
(try/catch swallow; logging must never break the action it records).

**Instrumented actions** (org APIs + client portal decisions): inquiry status
change; milestone upsert/delete/fund/request-release; portal milestone approve;
proposal create + portal accept/decline; vendor create/update/delete/verify;
team grant/revoke/invite; message reply; task create/status/delete; expense
create/status/delete; payment success (reconcile webhook, actor `paystack`).

**Surfaces:** `GET /api/org/activity [?inquiry=&limit=]`; "Recent activity" card on
the dashboard (overview API returns latest 12); per-client activity card on
`OrgClient.jsx`.

## Cross-cutting

- **Nav:** add `Tasks` and `Books` to the `/org` quick-links nav.
- **Guide:** add short "Tasks", "Books", and activity mentions to the organizer
  section of `src/lib/guide.js` so `/guide` stays truthful.
- **Auth:** every new endpoint gates on `currentOrganizer` (403 otherwise), prepared
  statements only, `clampStr` on all inputs — same as existing org APIs.
- **Money:** all new amounts are integer minor units; legacy `inquiries.estimate`
  (whole cedis) converted at the API boundary via `toMinor`.
- **Schema:** new tables only (`IF NOT EXISTS`) — re-run `schema.sql` locally and
  `--remote`; no ALTERs, no migrations.
- **Tests:** extend `scripts/test-money.mjs` with books cases (expense totals,
  margins, CSV escaping).

## Out of scope (deliberately)

Invoicing/PDF, vendor payouts, role-based permissions (all organizers stay equal),
receipt file uploads (URL field only — no object storage today), reminders/notifications.
