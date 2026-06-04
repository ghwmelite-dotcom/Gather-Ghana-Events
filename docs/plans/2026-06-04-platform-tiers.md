# Gather Ghana → Two-Sided Platform — Implementation Plan (Tiers 1–3)

**Goal:** Evolve the single-planner site into a defensible, viral, two-sided global event platform.

**Architecture:** Keep the stack (React/Vite/Tailwind + Cloudflare Pages Functions + D1 + Paystack). Add new D1 tables and `/api` routes alongside the existing ones. The flywheel core is the **public Event Page** (every guest is exposed to the platform) + **Contribution Pools** (guests become payers) + **Escrow** (trust) + **Diaspora multi-currency** (the wedge). Reuse existing libs (`paystack.js`, `payments.js`, `auth.js`, `respond.js`, `util.js`) and frontend primitives (`Button`, `Field`, `Img`, `Section`, `Reveal`, `Seo`).

**Verification:** `npm run build` + live API smoke tests (`curl`) per increment, matching the project's established pattern. Money-critical logic (currency math, escrow state machine, reference routing) gets Vitest unit tests.

**Sequencing principle (Jim Collins flywheel):** ship the highest-leverage viral/trust pieces first, then liquidity/intelligence, then organizer lock-in.

---

## Shared foundations (build once, used by all tiers)

### Money & currency
- All amounts stored in **minor units (pesewas/cents)** as integers. Never floats.
- `src/lib/money.js` (frontend) + `functions/_lib/money.js` (backend): `toMinor`, `fromMinor`, `formatMoney(amount, currency)`, supported currencies `GHS, USD, GBP, EUR, NGN`.
- FX: `functions/_lib/fx.js` — rates table (seedable, refreshable later from an API). `convert(amount, from, to)`. Display-only conversion in Tier 1; settlement currency stays the planner's account currency.

### Payment reference routing (critical)
Today the Paystack callback/webhook assume a `payments` row. Generalize:
- Reference **prefixes**: `GGE-` deposit/balance (payments), `GGC-` contribution (contributions), `GGM-` milestone escrow funding.
- `functions/_lib/reconcile.js`: `reconcile(db, reference, meta)` looks up the reference across `payments` and `contributions`, updates the right table idempotently, and runs side effects (milestone seed, contribution tally). Callback + webhook both call it.

### DB migrations
Append to `schema.sql` (idempotent `CREATE TABLE IF NOT EXISTS` / `ALTER` guarded). New file `migrations/` not needed — we apply `schema.sql` with `--remote`.

---

## TIER 1 — The viral + trust unlock

### T1.1 — Event Pages (shareable per-event microsite)  [Both]
**Tables:** `events`, `event_schedule`, `event_gallery`, `rsvps`.
**Files:**
- DB: `schema.sql` (append tables)
- API: `functions/api/events/[slug].js` (GET public event), `functions/api/events/index.js` (POST create — auth), `functions/api/events/[slug]/rsvp.js` (POST public RSVP)
- FE: `src/pages/EventPage.jsx` (route `/e/:slug`), `src/lib/api.js` (+event methods), `src/main.jsx` (+route, outside Layout for a bespoke chrome)
**Event Page sections:** cover/hero (host names, date, countdown), story, run-of-show (schedule), gallery, livestream embed, **RSVP** block, **Contribution Pool** block (T1.2), share buttons (WhatsApp/copy).
**Acceptance:** visiting `/e/:slug` renders a public page; RSVP POST persists and updates the live count; unlisted/private visibility respected; SEO/OG per event.

### T1.2 — Contribution Pools / Cash Registry  [Both]
**Tables:** `contributions` (+ `events.contribution_goal`, `events.contributions_enabled`).
**Files:**
- API: `functions/api/events/[slug]/contribute.js` (POST → Paystack init, ref `GGC-`), reconcile wires success
- `functions/_lib/reconcile.js` (new), update `functions/api/paystack/callback.js` + `webhook.js` to call it
- FE: contribution widget inside `EventPage.jsx` (progress bar to goal, contributor wall, amount + message + optional anonymous)
**Acceptance:** a guest can contribute via Paystack; on success the pool total + contributor wall update; callback/webhook reconcile by `GGC-` prefix; money math in minor units verified by unit test.

### T1.3 — Escrow / "Gather Guarantee" milestone ledger  [Both]
**Tables:** extend `timeline_events` → add `amount`, `currency`, `escrow_status` (`none|funded|release_requested|released|disputed`); link `payments.milestone_id`.
**Files:**
- `functions/_lib/escrow.js` — state machine `fund → release_requested → released` (+ `dispute`), pure functions unit-tested
- API: `functions/api/portal/milestones.js` (client approves → release_requested→released; planner requests release), update `functions/api/portal/me.js` to surface escrow state + held/released totals
- FE: portal milestone cards show escrow state + "Approve & release" (client) / status (planner); Book/portal copy explains the guarantee
**Acceptance:** funds tracked as held vs released; client approval transitions a milestone to `released`; totals reflect in the portal; state machine unit-tested. (Real custodial movement via Paystack subaccounts/transfers is an operational follow-up; the ledger + approval flow ship now.)

### T1.4 — Diaspora Bridge (multi-currency display)  [Both]
**Files:**
- `functions/_lib/fx.js`, `functions/_lib/money.js`, `src/lib/money.js`
- FE: `src/lib/CurrencyContext.jsx` (selector persisted to localStorage), currency switch in header/footer; Book estimate, package prices, contribution amounts, portal totals all render in the chosen currency with a "charged in GHS" note
- API: `functions/api/fx.js` (GET current rates)
**Acceptance:** changing currency reprices all displayed amounts via FX; checkout still settles in GHS with a clear note; rates served from one endpoint.

---

## TIER 2 — Liquidity + intelligence

### T2.1 — Verified Vendor Marketplace  [Both]
**Tables:** `vendors` (profile, category, location, verified, rating), `vendor_reviews`, `vendor_media`.
**Files:** `functions/api/vendors/*` (list/filter/detail, submit review — auth), `src/pages/Vendors.jsx` (directory + filters), `src/pages/VendorProfile.jsx` (`/vendors/:slug`), admin verify endpoint. **Acceptance:** browsable, filterable, verified badge, reviews gated to real clients.

### T2.2 — "Akwaaba" AI Event Concierge  [Both]
**Files:** `functions/api/ai/concept.js` (calls an LLM provider via env key — graceful 503 if unset), `src/pages/Concierge.jsx` (vision → budget breakdown + timeline + vendor shortlist + moodboard). **Provider-agnostic** via `functions/_lib/ai.js`. **Acceptance:** given budget/guests/vibe/culture, returns structured plan JSON rendered as cards; degrades cleanly without a key.

### T2.3 — Cultural Playbook Library  [Both]
**Files:** `src/lib/playbooks.js` (Ghanaian knocking/engagement, outdooring, Yoruba/Igbo, Indian sangeet…), `src/pages/Playbooks.jsx` + `/playbooks/:slug`, used to pre-fill events & AI prompts. **Acceptance:** each playbook seeds a schedule + checklist + budget template into a new event.

### T2.4 — WhatsApp-native layer  [Both]
**Files:** `functions/api/whatsapp/webhook.js` (Cloud API: RSVP, pay link, status), `functions/_lib/whatsapp.js`. Env-gated. **Acceptance:** inbound message → RSVP/pay link/status reply; no-op without credentials.

---

## TIER 3 — Organizer lock-in + monetization depth

### T3.1 — Organizer OS  [Organizer]
**Tables:** `organizers`, `proposals`, `contracts`, `invoices`, `tasks`. Multi-tenant: scope existing `inquiries/events` by `organizer_id`.
**Files:** `functions/api/org/*` (CRM, proposals, e-sign stub, invoicing), `src/pages/org/*` (dashboard, clients, proposals, day-of command center with live run-of-show). **Acceptance:** an organizer manages clients/proposals/invoices and runs a live day-of timeline.

### T3.2 — Financing + Legacy  [Both]
**Files:** `functions/api/financing/*` (MoMo installment schedule on a booking), post-event `functions/api/events/[slug]/archive.js` (permanent gallery + AI highlight stub). **Acceptance:** installment plan generated + tracked; event archive persists post-date.

### Monetization (cross-cutting)
Take-rate on escrow + **cross-border FX spread**, vendor lead-gen/featured, organizer SaaS tiers, contribution-pool fee, guarantee insurance. Implement as a `fees` calc in `money.js` applied at payment init.

---

## Self-review
- **Coverage:** every panel Tier-1/2/3 feature maps to a section above. ✓
- **Type consistency:** amounts = integer minor units everywhere; references prefixed `GGE/GGC/GGM`; `reconcile()` is the single source of payment truth. ✓
- **No placeholders in build steps:** each implemented increment ships real code + a verification command. ✓

## Execution
Inline execution in this session, tier by tier, deploying after each coherent increment. Start: **T1.1 + T1.2** (Event Page + Contributions are tightly coupled), then T1.3, T1.4, then Tier 2, then Tier 3.
