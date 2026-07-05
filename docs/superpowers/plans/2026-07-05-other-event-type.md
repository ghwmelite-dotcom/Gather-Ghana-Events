# Custom "Other" Event Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user picks "Other" in the Start Planning and Build My Package flows, let them optionally name what the event is, and surface that label to the organizer and in the generated package.

**Architecture:** An optional free-text field appears only when "Other" is selected. In Book it prepends to the inquiry notes; in the Concierge/teaser it flows to `/api/ai/concept` as `otherType` and becomes the display label in the concept narrative + package summary. Event type stays `'Other'` for all backend logic; the label is a display layer. No schema change.

**Tech Stack:** React + Vite SPA, Cloudflare Pages Functions, Tailwind. One pure-logic tweak (unit-tested via `node scripts/test-packages.mjs`); the rest verified by `npm run build` + manual smoke test.

**Spec:** `docs/superpowers/specs/2026-07-05-other-event-type-design.md`

**Branch:** Create `feat/other-event-type` off `main` before Task 1.

---

## File Structure

- `functions/_lib/packages.js` — `packageSummary` accepts an optional `label` (modify).
- `scripts/test-packages.mjs` — assert the label fallback (modify).
- `functions/api/ai/concept.js` — parse `otherType`, compute display label, use it (modify).
- `src/pages/Concierge.jsx` — seed `otherType` from `?other`, render field when Other (modify).
- `src/components/sections/PackageTeaser.jsx` — Other field + carry `?other=` (modify).
- `src/pages/Book.jsx` — Other field + prepend to notes (modify).

---

### Task 1: `packageSummary` label fallback (+ test)

**Files:**
- Modify: `functions/_lib/packages.js`
- Modify: `scripts/test-packages.mjs`

- [ ] **Step 1: Add the failing assertions**

In `scripts/test-packages.mjs`, immediately before the final `console.log('OK: package helper assertions passed')` line, add:
```js
// packageSummary uses `label` for the Event line when provided, else falls back to `type`.
assert.ok(packageSummary({ type: 'Other', guests: 100, budget: 1000, perGuest: 10, priorities: [], split: [], label: 'Naming ceremony' }).includes('Event: Naming ceremony'))
assert.ok(packageSummary({ type: 'Wedding', guests: 100, budget: 1000, perGuest: 10, priorities: [], split: [] }).includes('Event: Wedding'))
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/test-packages.mjs`
Expected: FAIL — the first new assertion fails (summary prints `Event: Other`, not `Event: Naming ceremony`).

- [ ] **Step 3: Implement the label fallback**

In `functions/_lib/packages.js`, change the `packageSummary` signature and its `Event:` line. Current:
```js
export function packageSummary({ type, guests, budget, perGuest, priorities, split }) {
  const lines = split.map((s) => ` • ${s.label}: GHS ${Number(s.amount).toLocaleString()}`).join('\n')
  const pri = priorities && priorities.length ? priorities.join(', ') : 'none'
  return (
    `Custom package request\n` +
    `Event: ${type}\n` +
```
Change to:
```js
export function packageSummary({ type, guests, budget, perGuest, priorities, split, label }) {
  const lines = split.map((s) => ` • ${s.label}: GHS ${Number(s.amount).toLocaleString()}`).join('\n')
  const pri = priorities && priorities.length ? priorities.join(', ') : 'none'
  return (
    `Custom package request\n` +
    `Event: ${label || type}\n` +
```
(Leave the rest of the function unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-packages.mjs`
Expected: PASS — `OK: package helper assertions passed`

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/packages.js scripts/test-packages.mjs
git commit -m "feat(packages): packageSummary accepts a display label"
```

---

### Task 2: Concept endpoint uses the custom "Other" label

**Files:**
- Modify: `functions/api/ai/concept.js`

- [ ] **Step 1: Parse `otherType` and compute the label**

In `functions/api/ai/concept.js`, after the line `const culture = clampStr(body.culture, 80)`, add:
```js
  const otherType = clampStr(body.otherType, 80)
  const label = (type === 'Other' && otherType) ? otherType : type
  const labelText = (type === 'Other' && otherType) ? otherType : type.toLowerCase()
```

- [ ] **Step 2: Use `labelText` in the deterministic concept narrative**

Change the concept string. Current:
```js
  let concept =
    `A ${vibe || 'beautiful'} ${culture ? culture + ' ' : ''}${type.toLowerCase()} for ${guests} guests. ` +
```
to:
```js
  let concept =
    `A ${vibe || 'beautiful'} ${culture ? culture + ' ' : ''}${labelText} for ${guests} guests. ` +
```

- [ ] **Step 3: Use `label` in the AI enrichment prompt**

Change the AI `user` prompt. Current:
```js
      user: `Event: ${type}. Culture: ${culture || 'Ghanaian'}. Guests: ${guests}. Budget: GHS ${budget}. Vibe: ${vibe || 'warm and elegant'}.`,
```
to:
```js
      user: `Event: ${label}. Culture: ${culture || 'Ghanaian'}. Guests: ${guests}. Budget: GHS ${budget}. Vibe: ${vibe || 'warm and elegant'}.`,
```

- [ ] **Step 4: Pass `label` to the summary and return `eventLabel`**

Change the summary call. Current:
```js
  const summary = packageSummary({ type, guests, budget, perGuest, priorities, split })
```
to:
```js
  const summary = packageSummary({ type, guests, budget, perGuest, priorities, split, label })
```
Then in the returned `plan` object, add `eventLabel: label,`. Current:
```js
      type, guests, budget, perGuest, priorities, concept, palette, vendors, timeline,
      budgetSplit: split, summary, aiUsed,
```
to:
```js
      type, eventLabel: label, guests, budget, perGuest, priorities, concept, palette, vendors, timeline,
      budgetSplit: split, summary, aiUsed,
```

- [ ] **Step 5: Verify + commit**

Run: `node --check functions/api/ai/concept.js` (expect no output), then:
```bash
git add functions/api/ai/concept.js
git commit -m "feat(concept): use custom Other label in narrative, summary, and AI prompt"
```

---

### Task 3: Concierge — Other field + prefill from `?other`

**Files:**
- Modify: `src/pages/Concierge.jsx`

- [ ] **Step 1: Seed `otherType` from the URL and add it to form state**

In `src/pages/Concierge.jsx`, the param/form block currently is:
```jsx
  const [params] = useSearchParams()
  const paramType = TYPES.includes(params.get('type')) ? params.get('type') : 'Wedding'
  const paramBudget = Math.max(0, parseInt(params.get('budget')) || 50000)
  const paramGuests = Math.max(1, parseInt(params.get('guests')) || 150)
  const [form, setForm] = useState({ eventType: paramType, guests: paramGuests, budget: paramBudget, culture: 'Ghanaian', vibe: '' })
```
Change it to:
```jsx
  const [params] = useSearchParams()
  const paramType = TYPES.includes(params.get('type')) ? params.get('type') : 'Wedding'
  const paramBudget = Math.max(0, parseInt(params.get('budget')) || 50000)
  const paramGuests = Math.max(1, parseInt(params.get('guests')) || 150)
  const paramOther = (params.get('other') || '').slice(0, 80)
  const [form, setForm] = useState({ eventType: paramType, guests: paramGuests, budget: paramBudget, culture: 'Ghanaian', vibe: '', otherType: paramOther })
```
(The generate payload already spreads `...form`, so `form.otherType` is sent to the API as `body.otherType` automatically — no payload change needed.)

- [ ] **Step 2: Render the field when "Other" is selected**

The guests/budget row currently begins:
```jsx
            <div className="grid grid-cols-2 gap-4">
              <Field label="Guests" type="number" min="1" inputMode="numeric" value={form.guests} onChange={set('guests')} />
```
Insert the conditional field immediately BEFORE that `<div className="grid grid-cols-2 gap-4">`:
```jsx
            {form.eventType === 'Other' && (
              <Field label="Tell us what kind of event" value={form.otherType}
                onChange={(e) => setForm({ ...form, otherType: e.target.value.slice(0, 80) })}
                placeholder="Naming ceremony, graduation, funeral rites…" />
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Guests" type="number" min="1" inputMode="numeric" value={form.guests} onChange={set('guests')} />
```

- [ ] **Step 3: Build + commit**

Run: `npm run build` (expect exit 0), then:
```bash
git add src/pages/Concierge.jsx
git commit -m "feat(concierge): specify a custom Other event type (prefill from ?other)"
```

---

### Task 4: Homepage teaser — Other field + carry `?other=`

**Files:**
- Modify: `src/components/sections/PackageTeaser.jsx`

- [ ] **Step 1: Add `other` state**

In `src/components/sections/PackageTeaser.jsx`, after `const [guests, setGuests] = useState(150)`, add:
```jsx
  const [other, setOther] = useState('')
```

- [ ] **Step 2: Carry `other` in the query string when relevant**

Change the `build` function. Current:
```jsx
  const build = () => {
    const qs = new URLSearchParams({ type, budget: String(budget || 0), guests: String(guests || 0) })
    navigate(`/concierge?${qs.toString()}`)
  }
```
to:
```jsx
  const build = () => {
    const qs = new URLSearchParams({ type, budget: String(budget || 0), guests: String(guests || 0) })
    if (type === 'Other' && other.trim()) qs.set('other', other.trim())
    navigate(`/concierge?${qs.toString()}`)
  }
```

- [ ] **Step 3: Render the field when "Other" is selected**

The component currently has the type-button grid followed by the budget/guests grid:
```jsx
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
```
Insert the conditional input between them (after the type-grid `</div>`, before the budget/guests grid):
```jsx
          </div>
          {type === 'Other' && (
            <input type="text" value={other} onChange={(e) => setOther(e.target.value)} maxLength={80}
              placeholder="Tell us what kind of event…"
              className="w-full mb-4 rounded-xl border border-cream/25 bg-plum/40 text-cream px-3 py-2.5 outline-none focus:border-champagne placeholder-cream/40" />
          )}
          <div className="grid sm:grid-cols-2 gap-4">
```

- [ ] **Step 4: Build + commit**

Run: `npm run build` (expect exit 0), then:
```bash
git add src/components/sections/PackageTeaser.jsx
git commit -m "feat(home): teaser lets Other events specify a type"
```

---

### Task 5: Book — Other field + prepend to notes

**Files:**
- Modify: `src/pages/Book.jsx`

- [ ] **Step 1: Add `otherType` state**

In `src/pages/Book.jsx`, after `const [guests, setGuests] = useState(100)`, add:
```jsx
  const [otherType, setOtherType] = useState('')
```

- [ ] **Step 2: Prepend the custom type to notes on submit**

In `handleSubmit`, the notes composition currently is:
```jsx
    const vendorNote = requestedVendor ? `Requested vendor: ${requestedVendor} (${vendorSlug})` : ''
    const notes = [vendorNote, form.notes].filter(Boolean).join('\n\n')
```
Change it to:
```jsx
    const vendorNote = requestedVendor ? `Requested vendor: ${requestedVendor} (${vendorSlug})` : ''
    const typeNote = type === 'Other' && otherType.trim() ? `Event type: ${otherType.trim()}` : ''
    const notes = [typeNote, vendorNote, form.notes].filter(Boolean).join('\n\n')
```

- [ ] **Step 3: Render the field under the event-type buttons when "Other"**

The event-type `<fieldset>` ends with:
```jsx
                  </div>
                </fieldset>
```
Immediately AFTER `</fieldset>`, add:
```jsx

                {type === 'Other' && (
                  <Field
                    id="book-other-type"
                    label="Tell us what kind of event"
                    value={otherType}
                    onChange={(e) => setOtherType(e.target.value.slice(0, 80))}
                    placeholder="Naming ceremony, graduation, funeral rites…"
                  />
                )}
```

- [ ] **Step 4: Build + commit**

Run: `npm run build` (expect exit 0), then:
```bash
git add src/pages/Book.jsx
git commit -m "feat(book): specify a custom Other event type into the inquiry"
```

---

### Task 6: Verify + deploy

**Files:** none (operational). Requires the correct wrangler login (**ghwmelite@gmail.com / acct ea2eb3a9…**).

- [ ] **Step 1: Tests + build**

Run: `node scripts/test-packages.mjs && npm run build`
Expected: `OK: package helper assertions passed` then a clean build.

- [ ] **Step 2: Deploy to production**

Run: `npx wrangler pages deploy dist --project-name gather-ghana-events --branch main`
Expected: "Deployment complete". (No D1 migration — frontend + endpoint string only.)

- [ ] **Step 3: Manual verification on production**

1. `/book`: pick **Other** → the "Tell us what kind of event" field appears; other types hide it. Submit with e.g. "Naming ceremony" → the resulting inquiry's notes (in `/org`) contain `Event type: Naming ceremony`.
2. `/concierge`: pick **Other**, type "Naming ceremony", generate → the concept sentence reads "…naming ceremony…" and the package summary / hand-off shows `Event: Naming ceremony`.
3. Homepage teaser: pick **Other**, enter text, **Build My Package** → lands on `/concierge` with the field pre-filled and the package labelled accordingly.
4. Leaving the field blank in all three behaves exactly as before (generic "Other").

- [ ] **Step 4: Finish the branch**

Use `superpowers:finishing-a-development-branch` to merge `feat/other-event-type` to `main` (and push if desired).

---

## Self-Review Notes

- **Spec coverage:** §1 Book field + notes → Task 5; §2 Concierge field + `otherType` payload → Task 3; §3 teaser field + `?other=` → Task 4; §4 concept parse/label/narrative/AI/summary/eventLabel → Task 2; §5 `packageSummary` label → Task 1. Testing (summary label assertion) → Task 1. All covered.
- **Name consistency:** `otherType` is the field/state name in Book (Task 5) and Concierge form (Task 3) and the API body key parsed in concept.js (Task 2); the teaser uses `other` locally but emits the `?other=` param (Task 4) which Concierge reads into `form.otherType` (Task 3) and sends back as `body.otherType` — the contract closes. `label` is defined in Task 2 and consumed by `packageSummary`'s `label` param defined in Task 1. `eventLabel` is added to the response (Task 2) and not otherwise depended upon (display/debug only).
- **No regressions:** all fields are gated on `type/eventType === 'Other'`; empty values fall back to prior behavior; `event_type`/`plan.type` stay `'Other'`; budget math and `EVENT_TYPES` validation untouched. Client-side `.slice(0, 80)` mirrors the server `clampStr(…, 80)`.
