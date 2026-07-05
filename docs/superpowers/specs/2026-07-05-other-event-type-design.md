# Specify a custom "Other" event type — design

**Date:** 2026-07-05
**Status:** Approved (pending spec review)

## Problem & goal

When a user picks the **Other** event type in the "Start Planning" (`/book`) or "Build My Package"
(`/concierge`, and its homepage teaser) flows, they currently cannot say what "Other" actually is.
Goal: when "Other" is selected, show an optional free-text field so the user can name their event
type, and surface that label to the organizer (and in the generated package) without adding new
event categories or changing the budget logic.

## Decisions locked

- The field is **optional**. If left blank, behavior is exactly as today.
- The field appears **only** when "Other" is selected.
- No new event-type categories; the stored/processed event type stays `'Other'`. The custom text is
  a display/label layer only.
- No schema change; the label rides along in existing free-text (inquiry notes / package summary).

## Non-goals (YAGNI)

- No change to budget-split logic (`Other` still uses the `SPLITS.Other` weights).
- No new DB column or migration.
- No validation beyond a length clamp.
- No autocomplete / preset "other" suggestions.

## Design

### 1. Start Planning — `src/pages/Book.jsx`
- Add an `otherType` string to the page state (default `''`).
- When `type === 'Other'`, render a text `Field` labelled **"Tell us what kind of event"**
  (placeholder e.g. *"Naming ceremony, graduation, funeral rites…"*), shown directly under the
  event-type button row. Hidden for all other types.
- In `handleSubmit`, when `type === 'Other'` and `otherType` is non-empty, prepend
  `Event type: <otherType>` to the notes (joined with the existing vendor/notes composition using
  the same `[...].filter(Boolean).join('\n\n')` pattern already in place). Stored `event_type`
  stays `'Other'`.
- Clearing "Other" (picking another type) does not need to wipe `otherType`; it is simply not sent
  because the prepend is guarded by `type === 'Other'`.

### 2. Build My Package — `src/pages/Concierge.jsx`
- Extend the form state with `otherType` (seeded from the URL param `other`, clamped, else `''`).
- When `form.eventType === 'Other'`, render an inline text field **"Tell us what kind of event"**
  under the event-type selector.
- Include `otherType: form.otherType` in the `api.concept({...})` payload.
- No other client-side logic changes; `plan.type` still drives the UI as today.

### 3. Homepage teaser — `src/components/sections/PackageTeaser.jsx`
- Add `other` local state. When `type === 'Other'`, show the same optional text field.
- In `build()`, include `other` in the query string only when `type === 'Other'` and it is
  non-empty, producing `/concierge?type=Other&budget=…&guests=…&other=<text>`.

### 4. Concept endpoint — `functions/api/ai/concept.js`
- Parse `const otherType = clampStr(body.otherType, 80)`.
- Define one display label used everywhere the real event type should show:
  `const label = (type === 'Other' && otherType) ? otherType : type`.
- In the deterministic concept narrative, replace the current `type.toLowerCase()` interpolation
  with a lowercased-only-for-generic form:
  `const labelText = (type === 'Other' && otherType) ? otherType : type.toLowerCase()`, so it reads
  naturally (e.g. "A beautiful naming ceremony for 150 guests" — the custom text is used verbatim,
  the four generic types are lowercased as today).
- If the optional AI enrichment runs, pass `label` in the user prompt in place of `type` so the AI
  narrative reflects the real event type.
- Pass `label` to `packageSummary` (see §5) so the summary + WhatsApp text + resulting inquiry
  notes show the real event type.
- The response `plan.type` stays `'Other'` (so the hand-off `createInquiry` keeps a valid
  `EVENT_TYPES` value); add `plan.eventLabel = label` for display/debugging. Budget math unchanged.

### 5. Package summary — `functions/_lib/packages.js`
- `packageSummary({ type, ... })` currently prints `Event: ${type}`. Accept an optional `label`
  and print `Event: ${label || type}`. `concept.js` passes `label`. No other caller exists, so the
  signature change is safe.

## Data flow

Teaser (type=Other + other text) → `/concierge?...&other=…` → Concierge seeds `otherType`,
auto-generates → `POST /api/ai/concept` with `otherType` → endpoint labels the concept + summary
with the custom text → hand-off inquiry notes / WhatsApp text carry the real event type. The Book
flow captures the custom text straight into the inquiry notes.

## Error handling

- `otherType` is length-clamped (80 chars) server-side; empty/whitespace falls back to the generic
  "Other" behavior everywhere.
- Missing `other` URL param → Concierge field defaults to empty; no auto-fill breakage.
- Switching away from "Other" hides the field; stale values are never submitted (guarded by the
  `type === 'Other'` checks).

## Testing

Mostly UI + an endpoint string change (no new pure logic beyond the `label` fallback), so:
- Extend `scripts/test-packages.mjs` with an assertion that `packageSummary` prints the `label`
  when provided and falls back to `type` when not.
- Manual verification on a deploy:
  1. `/book`: pick "Other" → field appears; submit with text → inquiry note shows
     `Event type: <text>`; the field is hidden for other types.
  2. `/concierge`: pick "Other", enter text, generate → concept narrative + the summary "Event:"
     line show the custom text; WhatsApp/hand-off carry it.
  3. Homepage teaser: pick "Other", enter text, Build My Package → lands on `/concierge` with the
     field pre-filled and the package labelled with the custom text.
  4. Leaving the field blank behaves exactly as before in all three.

## Sequencing

Single implementation plan. Order: `packages.js` (+ test) → `concept.js` → `Concierge.jsx` →
`PackageTeaser.jsx` → `Book.jsx` → build, verify, deploy.
