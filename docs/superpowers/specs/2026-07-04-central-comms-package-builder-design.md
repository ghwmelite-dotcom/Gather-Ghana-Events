# Central comms + custom package builder — design

**Date:** 2026-07-04
**Status:** Approved (pending spec review)

## Problem & goals

Two related goals, both funneling all client communication through the central management
(the organizer), never client-to-vendor directly:

- **A — Central comms for vendors:** clients can browse the vendor marketplace but cannot
  contact a vendor directly. The only path to engage a vendor is through the organizer.
- **B — Custom package builder:** a prospective or current client enters budget, guest count,
  and their priority services, and the system auto-generates a costed custom package (with a
  breakdown of the services involved and suggested real vendors), then makes it one tap to
  reach the organizer — in-system and via WhatsApp-to-organizer.

This enhances the EXISTING "Akwaaba" Concierge (`/concierge` → `/api/ai/concept`), which already
takes event type, guests, and budget and returns a budget breakdown, per-guest cost, run-of-show,
vendor shortlist, concept text, and palette. B extends it; it is not a new build.

## Non-goals (YAGNI)

- No client↔vendor messaging of any kind (we are removing the only such channel).
- No exact/binding quotes — all figures are indicative ("from"), the organizer confirms.
- No ML — priority reweighting is a deterministic function.
- No new "interior decoration" category — it is folded into the existing Décor line (see below).
- No schema changes — the generated package rides along in the inquiry's notes.

## Decisions locked

- **Priority input:** the client ranks 1–2 service categories; the budget split shifts toward
  them and rebalances to 100%.
- **Package depth:** hybrid — a costed category backbone plus 2–3 real marketplace vendors per
  category that fit the budget.
- **Interior decoration:** folded into Décor. The Wedding décor budget line is renamed
  `Décor, florals & interior styling`; other event types' décor lines already cover it. No new
  vendor category — décor vendors serve interior styling.

---

## Project A — Route all vendor communication through the organizer

### A1. `src/pages/VendorProfile.jsx`
- Remove the "Message on WhatsApp" anchor (the `vendor.whatsapp` block) entirely.
- Change the sidebar copy from "Add {vendor.name} to your plan, or reach out directly." to
  "Add {vendor.name} to your plan — our team coordinates everything for you."
- Keep the "Request this vendor" button, but point it at `/book?vendor=<slug>` (carry the slug),
  instead of a bare `/book`.

### A2. `functions/api/vendors/[slug].js`
- Remove `whatsapp` from the `SELECT` / returned vendor object. The column remains in the DB for
  the organizer's internal use; it is simply never served to the public client.

### A3. Booking inquiry carries the requested vendor
- The Book page reads `?vendor=<slug>`. When present, it resolves the vendor name (from the
  existing public vendor endpoint), shows a "Requesting: **Vendor Name**" chip, and includes
  `Requested vendor: <name> (<slug>)` in the inquiry `notes` submitted to `POST /api/inquiries`.
- No schema change: the requested vendor lives in the inquiry notes the organizer already reads.

### A4. Result
Clients can view vendor profiles (photos, about, reviews, "from" price) but every engagement path
routes to the organizer via the booking inquiry.

---

## Project B — Custom package builder + organizer hand-off

### B1. Priority reweighting (pure function)
- New optional input `priorities`: an array of 0–2 canonical category keys from the fixed set
  `['venue','catering','decor','photography','music','beauty']`.
- Each budget-split label maps to a canonical key by keyword:
  - contains `venue` → `venue`; contains `cater` → `catering`;
    contains `décor`/`decor`/`floral`/`styl`/`theme`/`stage` → `decor`;
    contains `photo` → `photography`; contains `music`/`entertain` → `music`;
    contains `attire`/`beauty`/`makeup` → `beauty`.
- Reweight: multiply each split's percentage by `1.6` if its canonical key is in `priorities`,
  else `1.0`; renormalize so percentages sum to 100 (round to integers, absorb rounding drift into
  the largest line). Amounts recompute as `round(budget * pct / 100)`.
- Implemented as a testable pure function (e.g. `reweightSplit(split, priorities)` in
  `functions/_lib/packages.js`), unit-tested via a `node scripts/*.mjs` assertion file.

### B2. Real-vendor suggestions (DB-aware endpoint)
- `functions/api/ai/concept.js` becomes DB-aware. For each reweighted budget line, map its
  canonical key to marketplace vendor categories:
  `venue→['venue'], catering→['catering'], decor→['decor'], photography→['photography'],
   music→['music'], beauty→['makeup']`.
- Query up to 3 vendors per line: `SELECT slug, name, category, price_from, verified, rating
  FROM vendors WHERE category IN (...) AND (price_from <= <lineAmount*100> OR price_from IS NULL)
  ORDER BY verified DESC, rating DESC, price_from ASC LIMIT 3`. If none fit the budget, fall back
  to the cheapest 3 in-category so a suggestion always appears when inventory exists.
- Attach `suggestions: [{ slug, name, priceFrom }]` to each budget-split line in the response.
- Endpoint also returns `contact: { whatsapp: env.ORGANIZER_WHATSAPP || null }` for the hand-off.
- The deterministic plan still works with zero vendors in the DB (suggestions simply empty).

### B3. Concierge UI (`src/pages/Concierge.jsx`)
- Add a **priority picker**: six tappable chips (Venue, Catering, Décor & styling, Photography,
  Music, Beauty), max 2 selected, sent as `priorities`. Selecting 0 keeps default weighting.
- Under each budget line, render its `suggestions` as links to `/vendors/<slug>` (which now route
  through the organizer per Project A). Label prices "from". If a line has no suggestions, omit
  the sub-list.
- All amounts and suggestions carry an "indicative — your planner confirms final pricing" note.

### B4. Organizer hand-off (replaces the "Bring it to life → /book" CTA)
A hand-off card with two actions:
- **Send this plan to our team:** a compact form (name, email, phone — phone optional if email
  given, and vice versa) that calls `POST /api/inquiries` with `eventType`, `guests`, `budget`,
  and a formatted **package summary** in `notes` (event type, guests, budget, per-guest,
  priorities, each budget line + amount, and any suggested vendors). Shows a confirmation on
  success. This reuses the existing inquiry pipeline (client upsert + `sendInquiryEmails`), so the
  organizer receives a rich, qualified lead instead of a blank form.
- **Chat on WhatsApp:** a `https://wa.me/<number>?text=<encoded summary>` deep link built from
  `contact.whatsapp`. Hidden if `ORGANIZER_WHATSAPP` is unset. The prefilled text is a concise
  package summary (event type, guests, budget, top priorities).

### B5. Config
- New `ORGANIZER_WHATSAPP` (E.164 digits, no `+`, e.g. `233201234567`) in `wrangler.toml` `[vars]`.
  Absent → the WhatsApp button is simply not shown; the in-system hand-off still works.

---

## Data flow

1. Client fills the Concierge form (type, guests, budget, culture, vibe, **priorities**).
2. `POST /api/ai/concept` → reweighted split + per-line real-vendor suggestions + concept/palette/
   timeline + `contact.whatsapp`.
3. Client either (a) taps a suggested vendor → `/vendors/<slug>` → "Request this vendor" →
   `/book?vendor=…` → inquiry to organizer, or (b) uses the hand-off card → inquiry to organizer
   and/or WhatsApp-to-organizer. Every path terminates at the organizer.

## Error handling

- Concept endpoint: invalid/missing numbers clamp to sane defaults (as today). DB query failure
  degrades gracefully to empty `suggestions` (deterministic plan still returned).
- Hand-off form: validates that at least one contact method (email or phone) and a name are
  present before submit; surfaces API errors inline.
- Vendor profile with no `whatsapp` served: no direct-contact UI renders (nothing to hide).

## Testing

- Pure logic unit-tested via a standalone `node` assertion script: `reweightSplit` (priorities
  boost the right lines, output sums to 100, amounts match budget) and the label→canonical-key
  keyword mapper.
- Endpoint + UI: manual verification on a preview deploy —
  1. Vendor profile shows no WhatsApp/direct-contact; "Request this vendor" carries the slug into
     `/book` and the inquiry notes.
  2. Concierge with priorities visibly shifts the budget bars toward the chosen categories.
  3. Suggested vendors appear per category and link to profiles.
  4. "Send this plan" creates an inquiry whose notes contain the full package; organizer sees it.
  5. WhatsApp button opens `wa.me` with the prefilled summary (when `ORGANIZER_WHATSAPP` set).

## Sequencing

Phase A (small) first, then Phase B. One spec, one implementation plan with A and B as ordered
task groups.
