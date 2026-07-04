# Central Comms + Custom Package Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route all vendor communication through the organizer, and turn the existing Concierge into a custom package builder (priorities + costed breakdown + real-vendor suggestions) that hands prospects straight to the organizer in-system and via WhatsApp.

**Architecture:** Phase A removes the only client→vendor channel (WhatsApp) and carries the requested vendor into the booking inquiry. Phase B adds a pure reweighting/suggestion library (`functions/_lib/packages.js`), makes `/api/ai/concept` DB-aware, relaxes the inquiries endpoint for anonymous leads, and enhances `Concierge.jsx` with a priority picker, per-category real-vendor suggestions, and an organizer hand-off card. No schema changes.

**Tech Stack:** Cloudflare Pages Functions (JS), D1 (SQLite), React + Vite SPA, Tailwind. Pure logic unit-tested with a standalone `node` assertion script; endpoints/UI verified manually on a preview deploy.

**Spec:** `docs/superpowers/specs/2026-07-04-central-comms-package-builder-design.md`

**Branch:** Create `feat/central-comms-packages` off `main` before Task 1.

---

## File Structure

- `functions/api/vendors/[slug].js` — stop selecting/returning `whatsapp` (modify).
- `src/pages/VendorProfile.jsx` — remove WhatsApp CTA + "reach out directly" copy; Request → `/book?vendor=<slug>` (modify).
- `src/pages/Book.jsx` — read `?vendor=`, show chip, prepend to inquiry notes (modify).
- `functions/_lib/packages.js` — pure helpers: `PRIORITY_KEYS`, `labelToKeys`, `vendorCategoriesForKey`, `reweightSplit`, `packageSummary` (create).
- `scripts/test-packages.mjs` — node assertions for the pure helpers (create).
- `functions/api/ai/concept.js` — priorities reweight, per-line DB vendor suggestions, `summary`, `contact`, décor rename (modify).
- `functions/api/inquiries.js` — make `phone` + `date` optional (modify).
- `src/pages/Concierge.jsx` — priority picker, suggestions, organizer hand-off card (modify).
- `wrangler.toml` — add `ORGANIZER_WHATSAPP` var (modify).

---

## PHASE A — Route all vendor communication through the organizer

### Task 1: Remove the direct client→vendor contact channel

**Files:**
- Modify: `functions/api/vendors/[slug].js:8-9`
- Modify: `src/pages/VendorProfile.jsx:9,133-142`

- [ ] **Step 1: Stop serving the vendor WhatsApp field**

In `functions/api/vendors/[slug].js`, change the SELECT so it no longer includes `whatsapp`:

```js
  const vendor = await env.DB
    .prepare(
      `SELECT id, slug, name, category, location, tagline, about, image, price_from,
              currency, verified, rating, reviews_count
       FROM vendors WHERE slug = ?`
    )
    .bind(params.slug)
    .first()
```

- [ ] **Step 2: Remove the direct-contact UI and fix the copy**

In `src/pages/VendorProfile.jsx`, replace the sidebar "Contact / request" block (currently lines 132-142) with:

```jsx
          {/* Request via the organizer — no direct vendor contact */}
          <div className="rounded-3xl bg-plum text-cream p-7 lg:sticky lg:top-28">
            <h2 className="font-display text-2xl mb-2">Like what you see?</h2>
            <p className="text-cream/65 text-sm leading-relaxed">Add {vendor.name} to your plan — our team coordinates everything for you.</p>
            <Button to={`/book?vendor=${vendor.slug}`} variant="gold" size="md" className="w-full mt-6">Request this vendor <ArrowRight size={18} /></Button>
          </div>
```

Then remove the now-unused `WhatsApp` icon from the import on line 9:

```jsx
import { CheckCircle, Spinner, ArrowLeft, ArrowRight } from '../lib/icons.jsx'
```

- [ ] **Step 3: Verify no direct-contact references remain**

Run: `grep -n "whatsapp\|WhatsApp\|reach out directly" src/pages/VendorProfile.jsx functions/api/vendors/[slug].js`
Expected: no matches.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add functions/api/vendors/[slug].js src/pages/VendorProfile.jsx
git commit -m "feat(vendors): remove direct client-to-vendor contact; route via organizer"
```

---

### Task 2: Booking inquiry carries the requested vendor

**Files:**
- Modify: `src/pages/Book.jsx:1-2,52-60,78-96`

- [ ] **Step 1: Read the `?vendor=` slug and resolve its name**

In `src/pages/Book.jsx`, the component already imports `useSearchParams` and `api`. Inside the `Book` component, after the existing `const [params] = useSearchParams()` (line 59), add state + an effect that resolves the vendor name:

```jsx
  const vendorSlug = params.get('vendor')
  const [requestedVendor, setRequestedVendor] = useState('')
  useEffect(() => {
    if (!vendorSlug) return
    let cancelled = false
    api.vendor(vendorSlug)
      .then((r) => { if (!cancelled) setRequestedVendor(r?.vendor?.name || '') })
      .catch(() => {})
    return () => { cancelled = true }
  }, [vendorSlug])
```

- [ ] **Step 2: Show a "Requesting" chip above the form**

In `src/pages/Book.jsx`, inside the `<form onSubmit={handleSubmit} ...>` (just after the opening `<form>` tag on line 171), add:

```jsx
                {requestedVendor && (
                  <div className="rounded-xl bg-champagne-pale border border-champagne/40 px-4 py-3 text-sm text-plum">
                    Requesting: <span className="font-medium">{requestedVendor}</span> — we&apos;ll coordinate them for your event.
                  </div>
                )}
```

- [ ] **Step 3: Include the requested vendor in the inquiry notes**

In `handleSubmit`, change the `payload` construction (lines 89-95) so the requested vendor is prepended to notes:

```jsx
    const vendorNote = requestedVendor ? `Requested vendor: ${requestedVendor} (${vendorSlug})` : ''
    const notes = [vendorNote, form.notes].filter(Boolean).join('\n\n')
    const payload = {
      type,
      guests: Number(guests) || 0,
      estimate: Math.round(total),
      deposit: Math.round(deposit),
      ...form,
      notes,
    }
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Book.jsx
git commit -m "feat(book): carry requested vendor from profile into the inquiry"
```

---

## PHASE B — Custom package builder + organizer hand-off

### Task 3: Pure package logic + tests

**Files:**
- Create: `functions/_lib/packages.js`
- Create: `scripts/test-packages.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-packages.mjs`:

```js
// Standalone assertions for package helpers. Run: node scripts/test-packages.mjs
import assert from 'node:assert/strict'
import { PRIORITY_KEYS, labelToKeys, vendorCategoriesForKey, reweightSplit, packageSummary } from '../functions/_lib/packages.js'

// labelToKeys — combined line yields both keys; décor synonyms map to 'decor'.
assert.deepEqual(labelToKeys('Venue & catering'), ['venue', 'catering'])
assert.deepEqual(labelToKeys('Décor, florals & interior styling'), ['decor'])
assert.deepEqual(labelToKeys('Stage, lighting & décor'), ['decor'])
assert.deepEqual(labelToKeys('Photography & film'), ['photography'])
assert.deepEqual(labelToKeys('Attire & beauty'), ['beauty'])
assert.deepEqual(labelToKeys('Music & entertainment'), ['music'])

// vendorCategoriesForKey — beauty maps to the DB 'makeup' category.
assert.deepEqual(vendorCategoriesForKey('beauty'), ['makeup'])
assert.deepEqual(vendorCategoriesForKey('venue'), ['venue'])
assert.deepEqual(vendorCategoriesForKey('nope'), [])

// reweightSplit — with no priorities, percentages are preserved and sum to 100.
const base = [
  { label: 'Venue & catering', pct: 45 },
  { label: 'Décor, florals & interior styling', pct: 20 },
  { label: 'Photography & film', pct: 15 },
  { label: 'Music & entertainment', pct: 10 },
  { label: 'Attire & beauty', pct: 10 },
]
const same = reweightSplit(base, [])
assert.equal(same.reduce((a, s) => a + s.pct, 0), 100)
assert.equal(same.find((s) => s.label === 'Venue & catering').pct, 45)

// reweightSplit — prioritizing photography raises its share; total stays 100.
const pri = reweightSplit(base, ['photography'])
assert.equal(pri.reduce((a, s) => a + s.pct, 0), 100)
assert.ok(pri.find((s) => s.label === 'Photography & film').pct > 15, 'photography boosted')
assert.ok(pri.find((s) => s.label === 'Music & entertainment').pct < 10, 'others trimmed')

// reweightSplit — a priority on a combined line boosts that line.
const priCombined = reweightSplit(base, ['catering'])
assert.ok(priCombined.find((s) => s.label === 'Venue & catering').pct > 45, 'combined line boosted')

// packageSummary — includes the key facts.
const s = packageSummary({ type: 'Wedding', guests: 150, budget: 50000, perGuest: 333, priorities: ['photography'], split: [{ label: 'Photography & film', amount: 12000 }] })
assert.ok(s.includes('Wedding') && s.includes('150') && s.includes('50,000') && s.includes('Photography & film'))

console.log('OK: package helper assertions passed')
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/test-packages.mjs`
Expected: FAIL — cannot find module `../functions/_lib/packages.js`.

- [ ] **Step 3: Implement the helpers**

Create `functions/_lib/packages.js`:

```js
// Pure logic for the custom package builder: priority reweighting, label→category
// mapping, and human-readable summaries. No I/O — unit-tested via scripts/test-packages.mjs.

export const PRIORITY_KEYS = ['venue', 'catering', 'decor', 'photography', 'music', 'beauty']

/** All canonical priority keys a budget-split label touches (a combined line yields several). */
export function labelToKeys(label) {
  const s = String(label).toLowerCase()
  const keys = []
  if (s.includes('venue')) keys.push('venue')
  if (s.includes('cater')) keys.push('catering')
  if (/décor|decor|floral|styl|theme|stage/.test(s)) keys.push('decor')
  if (s.includes('photo')) keys.push('photography')
  if (/music|entertain/.test(s)) keys.push('music')
  if (/attire|beauty|makeup/.test(s)) keys.push('beauty')
  return keys
}

/** Marketplace vendor categories that serve a canonical key ('beauty' → DB 'makeup'). */
export function vendorCategoriesForKey(key) {
  return {
    venue: ['venue'], catering: ['catering'], decor: ['decor'],
    photography: ['photography'], music: ['music'], beauty: ['makeup'],
  }[key] || []
}

/**
 * Reweight a [{label, pct}] split toward prioritized categories.
 * Prioritized lines get their pct multiplied by `boost`; then all are renormalized to
 * sum exactly 100 (integers), with rounding drift absorbed by the largest line.
 * Returns [{label, pct}] (caller recomputes amounts from budget).
 */
export function reweightSplit(split, priorities = [], boost = 1.6) {
  const pris = new Set((priorities || []).filter((k) => PRIORITY_KEYS.includes(k)))
  const weighted = split.map((s) => {
    const isPri = labelToKeys(s.label).some((k) => pris.has(k))
    return { label: s.label, w: s.pct * (isPri ? boost : 1) }
  })
  const totalW = weighted.reduce((a, s) => a + s.w, 0) || 1
  const out = weighted.map((s) => ({ label: s.label, pct: Math.round((s.w / totalW) * 100) }))
  const drift = 100 - out.reduce((a, s) => a + s.pct, 0)
  if (drift !== 0 && out.length) {
    let maxIdx = 0
    out.forEach((s, i) => { if (s.pct > out[maxIdx].pct) maxIdx = i })
    out[maxIdx].pct += drift
  }
  return out
}

/** Human-readable package summary for inquiry notes + WhatsApp text. */
export function packageSummary({ type, guests, budget, perGuest, priorities, split }) {
  const lines = split.map((s) => ` • ${s.label}: GHS ${Number(s.amount).toLocaleString()}`).join('\n')
  const pri = priorities && priorities.length ? priorities.join(', ') : 'none'
  return (
    `Custom package request\n` +
    `Event: ${type}\n` +
    `Guests: ${guests}\n` +
    `Budget: GHS ${Number(budget).toLocaleString()} (~GHS ${Number(perGuest).toLocaleString()}/guest)\n` +
    `Priorities: ${pri}\n` +
    `Breakdown:\n${lines}`
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-packages.mjs`
Expected: PASS — `OK: package helper assertions passed`

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/packages.js scripts/test-packages.mjs
git commit -m "feat(packages): priority reweighting + label/category helpers (tested)"
```

---

### Task 4: Concept endpoint — priorities, real-vendor suggestions, summary, contact

**Files:**
- Modify: `functions/api/ai/concept.js`

- [ ] **Step 1: Rename the Wedding décor line to fold in interior styling**

In `functions/api/ai/concept.js`, in the `SPLITS` object, change the Wedding décor entry:

```js
  Wedding: [['Venue & catering', 45], ['Décor, florals & interior styling', 20], ['Photography & film', 15], ['Music & entertainment', 10], ['Attire & beauty', 10]],
```

(Leave Birthday/Corporate/Other as-is — their décor lines already read "…décor…" and map correctly.)

- [ ] **Step 2: Import the package helpers**

Add to the imports at the top of `functions/api/ai/concept.js`:

```js
import { reweightSplit, labelToKeys, vendorCategoriesForKey, packageSummary } from '../../_lib/packages.js'
```

- [ ] **Step 3: Apply priorities, attach suggestions, summary, and contact**

In `onRequestPost`, replace the block that currently computes `split`, `perGuest`, `timeline`, `vendors`, `palette` (currently lines 51-55) through the final `return ok({...})` with the following. This reweights the split, recomputes amounts, queries up to 3 budget-fitting vendors per line, and returns `summary` + `contact`:

```js
  const priorities = Array.isArray(body.priorities) ? body.priorities.slice(0, 2) : []

  // Base split → reweight toward priorities → recompute amounts.
  const baseSplit = SPLITS[type].map(([label, pct]) => ({ label, pct }))
  const reweighted = reweightSplit(baseSplit, priorities)
  const split = reweighted.map((s) => ({ ...s, amount: Math.round((budget * s.pct) / 100) }))

  const perGuest = guests > 0 ? Math.round(budget / guests) : 0
  const timeline = TIMELINE[type].map(([time, title]) => ({ time, title }))
  const vendors = VENDORS[type]
  const palette = pickPalette(vibe)

  // Attach up to 3 real, budget-fitting marketplace vendors per budget line.
  for (const line of split) {
    const cats = [...new Set(labelToKeys(line.label).flatMap(vendorCategoriesForKey))]
    if (!cats.length) { line.suggestions = []; continue }
    const placeholders = cats.map(() => '?').join(',')
    const cap = line.amount * 100 // pesewas
    try {
      const { results } = await env.DB
        .prepare(
          `SELECT slug, name, price_from FROM vendors
           WHERE category IN (${placeholders}) AND (price_from <= ? OR price_from IS NULL)
           ORDER BY verified DESC, rating DESC, price_from ASC LIMIT 3`
        )
        .bind(...cats, cap)
        .all()
      let rows = results
      if (!rows.length) {
        const fb = await env.DB
          .prepare(`SELECT slug, name, price_from FROM vendors WHERE category IN (${placeholders}) ORDER BY price_from ASC LIMIT 3`)
          .bind(...cats)
          .all()
        rows = fb.results
      }
      line.suggestions = rows.map((v) => ({ slug: v.slug, name: v.name, priceFrom: v.price_from }))
    } catch {
      line.suggestions = []
    }
  }

  // Deterministic concept (always present).
  let concept =
    `A ${vibe || 'beautiful'} ${culture ? culture + ' ' : ''}${type.toLowerCase()} for ${guests} guests. ` +
    `We'd anchor the day around warmth and detail — a considered palette, a clear run-of-show, and vendors matched to your vision.`
  let aiUsed = false

  if (isConfigured(env)) {
    const out = await complete(env, {
      system: 'You are an elegant Ghanaian event designer. Write 3 warm, concrete sentences describing a concept. No markdown, no lists.',
      user: `Event: ${type}. Culture: ${culture || 'Ghanaian'}. Guests: ${guests}. Budget: GHS ${budget}. Vibe: ${vibe || 'warm and elegant'}.`,
      maxTokens: 220,
    })
    if (out) { concept = out; aiUsed = true }
  }

  const summary = packageSummary({ type, guests, budget, perGuest, priorities, split })

  return ok({
    plan: {
      type, guests, budget, perGuest, priorities, concept, palette, vendors, timeline,
      budgetSplit: split, summary, aiUsed,
      contact: { whatsapp: env.ORGANIZER_WHATSAPP || null },
    },
  })
```

Note: remove the OLD `let concept = ...` / `aiUsed` / `return ok(...)` block that followed the original split computation, so it is not duplicated. The keyword-based `labelToKeys` handles the renamed décor label automatically.

- [ ] **Step 4: Verify syntax**

Run: `node --check functions/api/ai/concept.js`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add functions/api/ai/concept.js
git commit -m "feat(concept): priority reweighting, real-vendor suggestions, summary, contact"
```

---

### Task 5: Relax inquiries endpoint for anonymous package leads

**Files:**
- Modify: `functions/api/inquiries.js:25-31`

Context: the hand-off must accept anonymous prospects with minimal friction (name + email). Today the endpoint also requires `phone` and `date`. Make those optional. The Book page enforces its own stricter client-side rules, so it is unaffected.

- [ ] **Step 1: Require only name + valid email**

In `functions/api/inquiries.js`, replace the validation block (lines 26-31):

```js
  // Validate — name + email are required; phone/date optional (package-builder leads).
  const errors = {}
  if (!name) errors.name = 'Name is required'
  if (!isEmail(email)) errors.email = 'Valid email is required'
  if (Object.keys(errors).length) return fail('Please check the form', 422, { fields: errors })
```

(`phone` and `date` are still stored as-is when provided; they simply default to `''`.)

- [ ] **Step 2: Verify syntax**

Run: `node --check functions/api/inquiries.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add functions/api/inquiries.js
git commit -m "feat(inquiries): accept anonymous leads with name + email only"
```

---

### Task 6: Concierge — priority picker + vendor suggestions

**Files:**
- Modify: `src/pages/Concierge.jsx`

- [ ] **Step 1: Add priority state and the picker UI**

In `src/pages/Concierge.jsx`, add a priorities constant near `TYPES` (line 14):

```jsx
const PRIORITIES = [
  { key: 'venue', label: 'Venue' },
  { key: 'catering', label: 'Catering' },
  { key: 'decor', label: 'Décor & styling' },
  { key: 'photography', label: 'Photography' },
  { key: 'music', label: 'Music' },
  { key: 'beauty', label: 'Beauty' },
]
```

Add priorities state inside the component (after the `form` state, line 19):

```jsx
  const [priorities, setPriorities] = useState([])
  const togglePriority = (k) =>
    setPriorities((p) => (p.includes(k) ? p.filter((x) => x !== k) : p.length < 2 ? [...p, k] : p))
```

Send priorities in `generate` (change the `api.concept({...})` call, line 30):

```jsx
      const res = await api.concept({ ...form, guests: Number(form.guests), budget: Number(form.budget), priorities })
```

Add the picker to the form — insert immediately before the submit `<Button>` (line 69), after the vibe field:

```jsx
            <div>
              <label className="block text-sm text-ink/60 mb-3">Top priorities <span className="text-ink/40">(pick up to 2)</span></label>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((p) => (
                  <button key={p.key} type="button" onClick={() => togglePriority(p.key)}
                    aria-pressed={priorities.includes(p.key)}
                    className={`px-3 py-2 rounded-full border text-sm transition-all ${priorities.includes(p.key) ? 'border-plum bg-plum text-cream' : 'border-plum/20 text-ink/70 hover:border-plum/50'}`}>{p.label}</button>
                ))}
              </div>
            </div>
```

- [ ] **Step 2: Render real-vendor suggestions under each budget line**

In the "Budget breakdown" list, replace the single `<li>` body (lines 98-103) so each line also renders its suggestions:

```jsx
                    {plan.budgetSplit.map((b) => (
                      <li key={b.label}>
                        <div className="flex justify-between text-sm mb-1"><span className="text-ink/70">{b.label}</span><span className="text-plum tnum">{fmtGhs(b.amount)}</span></div>
                        <div className="h-2 rounded-full bg-plum/10 overflow-hidden"><div className="h-full bg-champagne rounded-full" style={{ width: `${b.pct}%` }} /></div>
                        {b.suggestions?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {b.suggestions.map((s) => (
                              <Link key={s.slug} to={`/vendors/${s.slug}`} className="text-xs px-2.5 py-1 rounded-full bg-cream border border-plum/15 text-plum hover:bg-plum/5 transition-colors">
                                {s.name}{s.priceFrom ? ` · from ${fmtGhs(s.priceFrom / 100)}` : ''}
                              </Link>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
```

Add an indicative-pricing note right under the "Budget breakdown" heading row — insert after line 96 (`</div>` closing the heading flex):

```jsx
                  <p className="text-xs text-ink/45 mb-4">Indicative — your planner confirms final pricing.</p>
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Concierge.jsx
git commit -m "feat(concierge): priority picker + real-vendor suggestions"
```

---

### Task 7: Concierge — organizer hand-off card + WhatsApp config

**Files:**
- Modify: `src/pages/Concierge.jsx`
- Modify: `wrangler.toml`

- [ ] **Step 1: Add the organizer WhatsApp config var**

In `wrangler.toml`, under the `[vars]` section (the same block that has `ORGANIZER_EMAILS`), add:

```toml
# Organizer WhatsApp number in E.164 digits, NO leading + (e.g. 233201234567).
# Unset → the WhatsApp hand-off button is hidden; in-system hand-off still works.
ORGANIZER_WHATSAPP = ""
```

- [ ] **Step 2: Add hand-off state + submit handler**

In `src/pages/Concierge.jsx`, add imports for the icons used (extend the existing icon import on line 9):

```jsx
import { Sparkles, ArrowRight, Spinner, WhatsApp, CheckCircle } from '../lib/icons.jsx'
```

Add hand-off state inside the component (after the `priorities` state):

```jsx
  const [lead, setLead] = useState({ name: '', email: '', phone: '', note: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [leadError, setLeadError] = useState('')

  const sendPlan = async () => {
    if (!lead.name.trim() || !lead.email.trim()) { setLeadError('Please add your name and email.'); return }
    setSending(true); setLeadError('')
    try {
      const notes = lead.note.trim() ? `${plan.summary}\n\nNote: ${lead.note.trim()}` : plan.summary
      await api.createInquiry({ type: plan.type, guests: plan.guests, estimate: plan.budget, deposit: 0, name: lead.name, email: lead.email, phone: lead.phone, notes })
      setSent(true)
    } catch (e2) {
      setLeadError(e2 instanceof ApiError ? e2.message : 'Could not send. Please try again.')
    } finally { setSending(false) }
  }
```

- [ ] **Step 3: Replace the weak CTA with the hand-off card**

In `src/pages/Concierge.jsx`, replace the final CTA block (currently lines 126-129, the "Love where this is going?" `<div>`) with:

```jsx
                <div className="rounded-3xl bg-plum text-cream p-7">
                  {sent ? (
                    <div className="text-center py-2">
                      <CheckCircle size={32} className="mx-auto text-champagne-light" />
                      <p className="font-display text-2xl mt-3">Sent — medaase!</p>
                      <p className="text-cream/70 text-sm mt-1">Our team has your package and will reach out shortly.</p>
                    </div>
                  ) : (
                    <>
                      <p className="font-display text-xl">Send this plan to our team</p>
                      <p className="text-cream/65 text-sm mt-1">We&apos;ll tailor it and reach out — no commitment.</p>
                      <div className="mt-5 space-y-3">
                        <Field label="Your name" value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} />
                        <Field label="Email" type="email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} inputMode="email" />
                        <Field label="Phone (optional)" type="tel" value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} inputMode="tel" />
                        <Field as="textarea" rows="2" label="Anything to add? (optional)" value={lead.note} onChange={(e) => setLead({ ...lead, note: e.target.value })} />
                      </div>
                      {leadError && <p role="alert" className="text-sm text-champagne-light mt-3">{leadError}</p>}
                      <Button onClick={sendPlan} variant="gold" size="md" loading={sending} className="w-full mt-4">Send to our team <ArrowRight size={18} /></Button>
                      {plan.contact?.whatsapp && (
                        <a href={`https://wa.me/${plan.contact.whatsapp}?text=${encodeURIComponent(plan.summary)}`} target="_blank" rel="noopener noreferrer"
                          className="mt-3 flex items-center justify-center gap-2 rounded-full border border-cream/25 py-3 text-sm hover:bg-cream/10 transition-colors">
                          <WhatsApp size={18} /> Chat on WhatsApp
                        </a>
                      )}
                    </>
                  )}
                </div>
```

Note: `ApiError` is already imported on line 10; `Field` is already imported on line 6. Confirm `WhatsApp` and `CheckCircle` exist in `src/lib/icons.jsx` (both are used elsewhere, e.g. VendorProfile/Login) — if a name differs, use the existing export.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Concierge.jsx wrangler.toml
git commit -m "feat(concierge): organizer hand-off card (in-system + WhatsApp)"
```

---

### Task 8: Verify + deploy

**Files:** none (operational). Requires the correct wrangler login (**ghwmelite@gmail.com / acct ea2eb3a9…**).

- [ ] **Step 1: Run the pure tests + build once more**

Run: `node scripts/test-packages.mjs && npm run build`
Expected: `OK: package helper assertions passed` then a successful build.

- [ ] **Step 2: (Optional) set the WhatsApp number as a production var**

If you have the organizer WhatsApp number, set it (either commit it in `wrangler.toml` `[vars]` or):
`npx wrangler pages secret put ORGANIZER_WHATSAPP --project-name gather-ghana-events` (enter digits, no `+`). If skipped, the WhatsApp button stays hidden and the in-system hand-off still works.

- [ ] **Step 3: Deploy to production**

Run: `npx wrangler pages deploy dist --project-name gather-ghana-events --branch main`
Expected: "Deployment complete".

- [ ] **Step 4: Manual verification on production**

1. Open a vendor profile → confirm there is **no** WhatsApp / direct-contact button; "Request this vendor" goes to `/book?vendor=…` and shows the "Requesting: <name>" chip.
2. Submit that booking → in `/org`, the inquiry note shows `Requested vendor: …`.
3. On `/concierge`: enter budget + guests, pick 2 priorities → the budget bars visibly shift toward them; suggested vendors appear under lines and link to profiles.
4. Fill the hand-off with just name + email → "Send to our team" succeeds; the new inquiry in `/org` contains the full package summary in its notes.
5. If `ORGANIZER_WHATSAPP` is set, "Chat on WhatsApp" opens `wa.me/<number>` with the prefilled summary.

- [ ] **Step 5: Finish the branch**

Use the `superpowers:finishing-a-development-branch` skill to merge `feat/central-comms-packages` to `main` (and push if desired).

---

## Self-Review Notes

- **Spec coverage:** A1 vendor WhatsApp removal → Task 1; A2 public API `whatsapp` → Task 1; A3 booking carries vendor → Task 2; B1 priority reweight → Task 3 (+ applied in Task 4); B2 real-vendor suggestions + `contact` → Task 4; interior-decoration fold-in (Wedding rename + keyword map) → Tasks 3 & 4; anonymous hand-off (inquiries relaxation) → Task 5; B3 priority picker + suggestions UI → Task 6; B4 hand-off card (in-system + WhatsApp) → Task 7; B5 `ORGANIZER_WHATSAPP` → Tasks 7 & 8; testing → Task 3 (pure) + Task 8 (manual). All covered.
- **Type/name consistency:** `reweightSplit`, `labelToKeys`, `vendorCategoriesForKey`, `packageSummary`, `PRIORITY_KEYS` defined in Task 3 and used identically in Task 4; response fields `plan.budgetSplit[].suggestions` (`{slug,name,priceFrom}`), `plan.summary`, `plan.contact.whatsapp` produced in Task 4 and consumed in Tasks 6–7; priority keys `['venue','catering','decor','photography','music','beauty']` identical between `PRIORITIES` (Task 6) and `PRIORITY_KEYS` (Task 3); `beauty→makeup` mapping consistent (Task 3) with the DB category list (`catering|decor|venue|photography|music|cake|makeup`).
- **Honesty guard:** every estimate carries "Indicative — your planner confirms final pricing" (Task 6) and suggestions are budget-filtered (Task 4).
- **Note:** `cake` marketplace category is intentionally not mapped to a priority key (no dedicated budget line); cake spend lives inside catering/other lines. Documented here so it isn't mistaken for a gap.
