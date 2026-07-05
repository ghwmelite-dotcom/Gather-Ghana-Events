# Fund-my-Event — Line-Itemized Event Funding · Design Spec

**Date:** 2026-07-05
**Status:** Approved design, pre-plan
**Public label:** "Gather & Give" (working name; finalize in the copy pass)

## Goal

Turn the **Instant Quote** breakdown into **individually fundable line items** on a couple's public
event page, so family — especially the diaspora — can contribute to *specific parts* of the celebration
("auntie covers the cake, cousin covers the décor"). This converts a throwaway cost estimate into a
shareable funding rail that drives payment volume and self-propagating reach (every contributor is a new
visitor), while staying honest about how the money moves.

## The three settled decisions

1. **Money model = single account, organizer disburses (no real custody).** Contributions settle directly
   into the studio's existing single Paystack merchant account, tagged to a line item. The organizer pays
   vendors as they do today. Trust comes from a **transparent ledger + per-part delivery status**, NOT from
   holding funds. There is no escrow, sub-account split, or stored-value balance in this feature.
2. **Attachment = extend the Event Page + Contribution Pool.** We line-itemize the existing pool rather than
   build a standalone funding page. Reuses `/e/:slug`, sharing, the Paystack `contribute` flow, and
   reconciliation. One shareable public page.
3. **Creation = organizer publishes.** The couple's quote arrives as a lead (the concierge already creates
   an inquiry); the organizer imports it onto the event page and publishes. Money is only solicited for
   events an organizer has taken on. The viral loop is untouched — the *page* is still shared widely; only
   *creation* is gated. Couple self-serve creation is explicitly deferred to v2.

## Non-goals (v1)

- Couple self-serve funding-page creation (v2).
- Vendor sub-account / Paystack split routing (the rejected Option-B money model).
- Refunds, contributor accounts, notifications to contributors, or a "thank-you wall" beyond the existing
  contributions display.
- Softening the *existing* Gather-Guarantee milestone copy that says "held/protected" — same honesty issue,
  tracked as a **separate** change, not part of this spec.

## Architecture

Additive changes to the existing platform (Cloudflare Pages Functions + D1 + Paystack). No new
infrastructure categories. New logic is isolated in a pure, unit-tested helper.

### Data model

**New table `event_line_items`** — the funding targets:

```sql
CREATE TABLE IF NOT EXISTS event_line_items (
  id              TEXT PRIMARY KEY,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,                 -- e.g. "Catering"
  category_key    TEXT,                          -- maps back to the quote category (packages.js keys)
  target_amount   INTEGER NOT NULL DEFAULT 0,    -- minor units (pesewas), event currency
  sort            INTEGER NOT NULL DEFAULT 0,
  visible         INTEGER NOT NULL DEFAULT 1,    -- couple/organizer can hide a line from the public page
  delivery_status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'booked' | 'delivered'
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_line_items_event ON event_line_items(event_id, visible, sort);
```

**Alter `contributions`** — let a contribution target one line:

```sql
ALTER TABLE contributions ADD COLUMN line_item_id TEXT;  -- nullable; NULL = general pool ("where needed most")
```

**Alter `inquiries`** — persist the quote so the organizer can import it:

```sql
ALTER TABLE inquiries ADD COLUMN quote_json TEXT;  -- JSON snapshot of the Instant Quote breakdown
```

`schema.sql` gets the `event_line_items` CREATE (re-runnable); the two ALTERs go in `migrations/` and are
applied to live D1.

### Components / boundaries

- **`functions/_lib/funding.js` (new, pure, unit-tested):** the only new business logic.
  - `fundingSummary(lineItems, contributions)` → `{ lines: [{ id, label, target, raised, pct, delivery_status, visible }], general: { raised }, totals: { target, raised, pct } }`.
  - `raised` per line = sum of `amount` over contributions where `status === 'success'` and
    `line_item_id === line.id`; `general.raised` = successful contributions with `line_item_id == null`.
  - Pure — no DB, no I/O. Tested via `node scripts/test-funding.mjs`.
- **Quote → line items import (`functions/_lib/funding.js` helper `lineItemsFromQuote(quoteJson)`):** maps a
  saved quote breakdown to `{ label, category_key, target_amount }[]`. Pure, tested.
- **Public read:** the event page endpoint (`functions/api/events/[slug].js`) additionally returns the
  visible line items and their progress (built from `event_line_items` + successful `contributions`).
- **Contribute (`functions/api/events/[slug]/contribute.js`):** accepts optional `lineItemId`; validates it
  belongs to the event and is `visible`; stores it on the `contributions` row at initialize time. Paystack
  init/verify/webhook and `reconcile.js` are unchanged — the line tag rides on the row already.
- **Organizer admin (`functions/api/org/events.js` + a line-items action):** import quote → create/curate
  line items (label, target, sort, visible), and set `delivery_status` per line. GET via `currentOrganizer`,
  writes via `currentEditor` (viewers blocked, consistent with the rest of `/org`).
- **UI:** `OrgEvents.jsx` / event editor gains an "Import quote as funding lines" + curate panel; the public
  event page (`/e/:slug`) renders each visible line with a progress bar, a "Contribute to this" action, a
  delivery badge, and keeps the general "wherever it's needed most" option.

### Data flow

1. Couple runs Instant Quote (`/concierge` → `/api/ai/concept`). On hand-off, the breakdown is written to
   the created lead as `inquiries.quote_json`.
2. Organizer works the lead, creates/links the event page (`OrgEvents`), clicks **Import quote as funding
   lines** → `event_line_items` rows created from `quote_json` via `lineItemsFromQuote`; organizer curates
   labels/targets/visibility and publishes with contributions enabled.
3. Public `/e/:slug` shows each visible line: `raised / target`, progress bar, delivery badge, "Contribute
   to this."
4. Guest contributes → `POST /api/events/:slug/contribute` with optional `lineItemId` → Paystack checkout →
   webhook/callback reconciles the `contributions` row to `status='success'` → it counts toward that line's
   `raised` (derived, no extra write).
5. Organizer views per-line progress, pays vendors off-platform, and advances each line
   `pending → booked → delivered`; the public page reflects it ("✓ Catering booked & paid").

## Trust & copy (the honest layer)

- **No "escrow", "held", or "protected" language anywhere in the funding flow.** Money settles to the studio
  immediately.
- Public framing: *"Contributions go to [Studio] to pay your vendors — you'll see each part marked done as
  it's delivered."*
- The delivery badge (`booked`/`delivered`) is the reassurance mechanism, backed by the transparent
  per-line ledger, in place of a custody claim.

## Error handling & edge cases

- **Over-funding a line** (raised > target): allowed. Show "100%+ 🎉"; never block generosity. Progress bar
  caps at 100% with a surplus note.
- **`lineItemId` not belonging to the event, or a hidden/closed line:** reject (422) at contribute time.
- **General pool** (`line_item_id` NULL): unchanged behavior; still works for events with no line items —
  full backward compatibility with existing event pages.
- **Contributions enabled off / private event:** existing guards apply before any line logic.
- **Currency:** targets and raised are in the event currency (GHS, minor units); diaspora multi-currency
  display remains a display-only estimate, unchanged.
- **Import with no `quote_json`:** organizer can still hand-add line items manually; import is a convenience.

## Testing

- **Unit (pure):** `scripts/test-funding.mjs` covering `fundingSummary` (per-line sums, only `success`
  counts, NULL→general, over-funding, empty) and `lineItemsFromQuote` (mapping, minor-unit conversion).
  Matches the existing `node scripts/test-*.mjs` convention.
- **E2E (seeded, prod playbook):** seed an event + line items + one `success` contribution tagged to a line;
  assert the public event page returns the correct per-line progress and the general pool still works.

## Rollout

1. Add `event_line_items` to `schema.sql`; write the two `ALTER`s to `migrations/`.
2. Build `funding.js` + tests; wire the public read, contribute `lineItemId`, org import/curate + delivery
   status; event-page and OrgEvents UI.
3. Apply migrations to live D1, deploy (manual wrangler), verify per the playbook.

## Open questions (non-blocking)

- Final public label ("Gather & Give" vs alternatives) — copy pass.
- Whether to show contributor names per line publicly, or only aggregate progress (default: reuse existing
  contributions display rules, incl. the `anonymous` flag).
