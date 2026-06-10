# Client Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistent inbox replies, an organizer↔client message thread per event (with email notifications + unread badges), and client-linking of inbound contact messages.

**Architecture:** Two new D1 tables (`message_replies`, `thread_messages`) + one nullable ALTER on `messages`. Two new action APIs (`/api/org/thread`, `/api/portal/thread`) mirroring the existing org/portal split. Pure unread-count logic in `functions/_lib/threads.js`, unit-tested. Thread cards on OrgClient + Portal; reply history in OrgMessages; unread badges on the dashboard.

**Tech Stack:** React/Vite/Tailwind, Cloudflare Pages Functions, D1, Resend.

**Spec:** `docs/superpowers/specs/2026-06-10-client-messaging-design.md`

---

### Task 1: Schema
**Files:** Modify `schema.sql` (append `message_replies`, `thread_messages` exactly per spec) · Create `migrations/add-message-client.sql` (`ALTER TABLE messages ADD COLUMN client_id TEXT;`)
- [ ] Append tables + indexes; write migration; commit `Schema: message_replies, thread_messages + messages.client_id`.

### Task 2: Pure logic (TDD)
**Files:** Create `functions/_lib/threads.js` · Modify `scripts/test-money.mjs`
- [ ] Tests first: `unreadCounts(rows)` groups `sender_role='client' AND read_by_org=0` by inquiry → `{ byInquiry: Map-like object, total }`; empty input → `{ byInquiry: {}, total: 0 }`; ignores organizer-sent and read rows.
- [ ] Run (fail) → implement → run (pass) → commit `Threads: unread-count logic + tests`.

### Task 3: Email template
**Files:** Modify `functions/_lib/email.js`
- [ ] `sendThreadNotice(env, { to, fromName, body, site, toPortal })` — brand shell, escaped body paragraphs, button to `/portal` (client) or `/org` (organizer). Commit with Task 4.

### Task 4: APIs
**Files:** Create `functions/api/org/thread.js`, `functions/api/portal/thread.js` · Modify `functions/api/org/messages.js`, `functions/api/contact.js`, `functions/api/org/overview.js`
- [ ] org/thread: GET `?inquiry=` (list asc, limit 200; side-effect `UPDATE … SET read_by_org=1`); POST insert organizer msg (born `read_by_org=1`), email client (look up client email via inquiry join), `logActivity('thread.send')`.
- [ ] portal/thread: same shape, ownership check `inquiries.client_id = session client`, roles flipped, notify `ORGANIZER_NOTIFY || ORGANIZER_EMAILS[0]`.
- [ ] messages.js: `reply` also INSERTs into `message_replies`; GET joins replies (group in JS) + `client_id` → client name + latest inquiry id.
- [ ] contact.js: look up `clients` by email; store `client_id`.
- [ ] overview.js: add `unreadMessages` total + per-inquiry counts merged into the `leads` rows (`unread` field).
- [ ] Commit `Messaging APIs: threads, persistent replies, client linking, unread counts`.

### Task 5: Frontend
**Files:** Modify `src/lib/api.js`, `src/pages/OrgClient.jsx`, `src/pages/Portal.jsx`, `src/pages/OrgMessages.jsx`, `src/pages/OrgDashboard.jsx`
- [ ] api.js: `orgThread(query)`, `orgThreadSend(payload)`, `portalThread(query)`, `portalThreadSend(payload)`.
- [ ] OrgClient: Messages card above Activity (bubbles: client = cream left, organizer = plum right; composer + Send; loads via `orgThread({inquiry:id})` on mount).
- [ ] Portal: "Messages with your planner" card for the primary inquiry (mirror orientation).
- [ ] OrgMessages: reply history under each message; "Existing client" chip → `/org/clients/:inquiryId` when linked.
- [ ] OrgDashboard: terracotta unread chip on lead rows (`lead.unread`); reuse stats.
- [ ] `npm run build` clean → commit `Messaging UI: thread cards, reply history, unread badges`.

### Task 6: Guide + verification
- [ ] `src/lib/guide.js`: organizer "Messages with clients" entry + client "Messaging your planner" entry.
- [ ] `node scripts/test-money.mjs` all pass; `npm run build` clean → commit.

### Task 7: Deploy + seed + E2E
- [ ] `wrangler d1 execute gather-ghana --file=./schema.sql --remote` + `--file=./migrations/add-message-client.sql`.
- [ ] Build, `wrangler pages deploy`, push.
- [ ] Extend `scripts/seed-demo.mjs` (thread section, idempotent standalone block) — seed a 4-message Mensah-wedding thread via both APIs (org session + client portal session via minted tokens).
- [ ] E2E against production: org send → portal GET shows + marks read; client send → overview unread=1 → org GET clears; contact POST from known email links client; inbox reply persists. Clean up only throwaway rows (keep the demo thread).
