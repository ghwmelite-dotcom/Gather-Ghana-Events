# Client Messaging — Design

**Date:** 2026-06-10
**Status:** Draft — awaiting user review

## Problem

The platform promises "everything tracked," but conversations are the exception:

1. **Inbox replies vanish.** `/org/messages` emails a reply via Resend but stores only
   `status`+`replied_at` — the reply text is discarded. If the sender writes back, the
   thread continues in private email, invisible to the team.
2. **No organizer ↔ client channel in-app.** The couple and planner talk on WhatsApp;
   none of it lands in the client record. Decisions ("yes to the GH₵6,400 florals")
   have no trail.
3. **Inbound messages are anonymous.** A contact-form message from an existing client
   is not linked to their record.

## Approaches considered

1. **Retrofit the `messages` table into a thread store** (add direction/parent/client
   columns). One table, but contact-form semantics (non-clients, name+email strangers)
   and client conversations are different things; the statuses and the inbox UI would
   fork into special cases.
2. **Two purpose-built additions** (recommended): (a) a `message_replies` table so the
   existing inbox keeps full history, and (b) a `thread_messages` table for per-event
   organizer↔client conversations, surfaced on the org client page and the portal.
   Matches the platform's shape — everything (milestones, tasks, expenses, activity)
   already hangs off an inquiry.
3. **Real-time chat** (WebSockets/Durable Objects, typing indicators, push). Overkill:
   conversations here are async and low-volume; email notifications close the loop.

**Chosen: approach 2.**

## Feature 1 — Inbox replies that persist

**Schema** (additive):

```sql
CREATE TABLE IF NOT EXISTS message_replies (
  id           TEXT PRIMARY KEY,
  message_id   TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  author_email TEXT,                -- the organizer who replied
  body         TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_replies_message ON message_replies(message_id);
```

**Changes:**
- `functions/api/org/messages.js` `reply` action: after the email sends, INSERT the
  reply row (multiple replies per message supported).
- `GET /api/org/messages`: return replies joined per message (latest 200 messages ×
  their replies).
- `OrgMessages.jsx`: show the reply history under each message (sender, time, body)
  — the inbox becomes a record, not a launcher.

## Feature 2 — Organizer ↔ client thread per event

**Schema:**

```sql
CREATE TABLE IF NOT EXISTS thread_messages (
  id             TEXT PRIMARY KEY,
  inquiry_id     TEXT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  sender_role    TEXT NOT NULL,              -- organizer | client
  sender_email   TEXT,
  body           TEXT NOT NULL,
  read_by_org    INTEGER NOT NULL DEFAULT 0, -- flipped when org views the thread
  read_by_client INTEGER NOT NULL DEFAULT 0, -- flipped when client views the thread
  created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_thread_inquiry ON thread_messages(inquiry_id);
```

A message sent by a role is born read by that role (`read_by_org=1` when the
organizer sends, etc.).

**APIs:**
- `/api/org/thread` (organizer-gated):
  - `GET ?inquiry=<id>` → messages oldest-first (limit 200); side effect: marks
    `read_by_org=1` for that inquiry.
  - `POST { inquiryId, body }` → insert as `organizer`; email the client
    ("New message from your planner" + body + portal link, via Resend); `logActivity`
    (`thread.send`, detail `Message to <client name>`).
- `/api/portal/thread` (client session):
  - `GET ?inquiry=<id>` → ownership-checked via `inquiries.client_id`; marks
    `read_by_client=1`.
  - `POST { inquiryId, body }` → ownership-checked; insert as `client`; email the
    organizer (`ORGANIZER_NOTIFY` or first `ORGANIZER_EMAILS`); `logActivity`
    (actor = client email).
- Body clamped to 4000 chars; no attachments (out of scope).

**Surfaces:**
- `OrgClient.jsx`: a **Messages** card in the right column (above Activity): thread
  bubbles (client left/cream, organizer right/plum), timestamps, composer + Send.
  Loaded with the page; viewing marks read.
- `Portal.jsx`: a **"Messages with your planner"** card for the portal's primary
  inquiry — same thread, opposite orientation; viewing marks read.
- `OrgDashboard.jsx`: unread badge per lead row (small terracotta count chip next to
  the client name) + an `unreadMessages` total in overview stats. Overview query:
  `SELECT inquiry_id, COUNT(*) … WHERE sender_role='client' AND read_by_org=0 GROUP BY inquiry_id`.

## Feature 3 — Link inbound contact messages to clients

**Schema** (one ALTER → `migrations/` per project convention; column is nullable so
existing rows are unaffected):

```sql
ALTER TABLE messages ADD COLUMN client_id TEXT;
```

**Changes:**
- `functions/api/contact.js`: on submit, `SELECT id FROM clients WHERE email = ?`;
  store `client_id` when matched.
- `GET /api/org/messages`: join client name/inquiry; `OrgMessages.jsx` shows an
  **"Existing client"** chip linking to `/org/clients/:inquiryId` (their latest
  inquiry) so the organizer can continue the conversation in the thread instead.

## Cross-cutting

- **Email notifications** are best-effort (same pattern as inquiry emails — failures
  never block the message insert). New template `sendThreadNotice` in
  `functions/_lib/email.js`, brand-styled like the magic-link email.
- **Activity:** `thread.send` logged both directions (the trail already shows
  message.reply for the inbox).
- **Tests:** pure helper `unreadCounts(rows)` (group client-unread by inquiry) in
  `functions/_lib/threads.js` + tests in `scripts/test-money.mjs`.
- **No polling/real-time:** threads refresh on page load and after send. Acceptable
  for v1; revisit only if usage shows need.
- **Guide:** add a short "Messages" entry to both organizer and client sections.
- **Demo data:** extend `scripts/seed-demo.mjs` with a 3–4 message thread on the
  Mensah wedding so the feature demos warm.

## Out of scope (deliberately)

Attachments/files, read receipts shown in UI, real-time updates (WebSockets/DO),
team-internal chat (tasks + activity cover it), WhatsApp/Telegram sync into threads,
broadcast/bulk messaging.

## Acceptance

1. Organizer replies to a contact message → reply text visible in the inbox forever.
2. Contact message from a known client shows the "existing client" chip.
3. Organizer sends a thread message → client gets a branded email; message appears in
   the portal; unread badge clears when the client opens it (and vice versa).
4. Client sends from the portal → organizer notified by email; unread count appears
   on the dashboard lead row; clears on viewing the client page thread.
5. All sends appear in the activity trail; 33+ unit tests still pass; build clean.
