# Package-builder Spotlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the custom event-package builder (`/concierge`) into a key, visible selling feature via an interactive homepage teaser, nav + hero CTAs, benefit-first rebranding, and a seamless prefill/auto-generate hand-off — plus wiring the real WhatsApp number.

**Architecture:** Pure frontend + config. A new homepage teaser collects type/budget/guests and navigates to `/concierge?…`; the Concierge page seeds its form from those params and auto-generates on arrival. Nav/footer/hero gain "Instant Quote" / "Build my package" entry points. The generation logic (`/api/ai/concept`, `functions/_lib/packages.js`) is untouched.

**Tech Stack:** React + Vite SPA, react-router-dom, Tailwind. No unit-testable logic added; verified by `npm run build` + manual smoke test on a deploy.

**Spec:** `docs/superpowers/specs/2026-07-04-package-builder-spotlight-design.md`

**Branch:** Create `feat/package-spotlight` off `main` before Task 1.

---

## File Structure

- `wrangler.toml` — set `ORGANIZER_WHATSAPP` (modify).
- `src/components/Layout.jsx` — add "Instant Quote" nav item, rename footer link, fix `WHATSAPP_URL` (modify).
- `src/pages/Concierge.jsx` — read URL params, seed form, auto-generate on arrival, rebrand header/SEO (modify).
- `src/pages/Home.jsx` — hero secondary CTA + render the teaser after Hero (modify).
- `src/components/sections/PackageTeaser.jsx` — the interactive homepage teaser (create).

---

### Task 1: Nav/footer surfacing + real WhatsApp number

**Files:**
- Modify: `src/components/Layout.jsx`
- Modify: `wrangler.toml`

- [ ] **Step 1: Add "Instant Quote" to the primary nav**

In `src/components/Layout.jsx`, the `navItems` array is:
```jsx
const navItems = [
  { to: '/', label: 'Home' },
  { to: '/services', label: 'Services' },
  { to: '/vendors', label: 'Vendors' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]
```
Change it to (insert Instant Quote after Vendors):
```jsx
const navItems = [
  { to: '/', label: 'Home' },
  { to: '/services', label: 'Services' },
  { to: '/vendors', label: 'Vendors' },
  { to: '/concierge', label: 'Instant Quote' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]
```

- [ ] **Step 2: Point the WhatsApp URL at the real number**

In `src/components/Layout.jsx`, change:
```jsx
const WHATSAPP_URL = 'https://wa.me/233000000000'
```
to:
```jsx
const WHATSAPP_URL = 'https://wa.me/233505982361'
```

- [ ] **Step 3: Rename the footer link for consistency**

In `src/components/Layout.jsx`, change the footer list item:
```jsx
              <li><Link to="/concierge" className="link-underline">AI Concierge</Link></li>
```
to:
```jsx
              <li><Link to="/concierge" className="link-underline">Instant Quote</Link></li>
```

- [ ] **Step 4: Set the organizer WhatsApp var**

In `wrangler.toml`, the `[vars]` block currently has:
```toml
ORGANIZER_WHATSAPP = ""
```
Change it to:
```toml
ORGANIZER_WHATSAPP = "233505982361"
```

- [ ] **Step 5: Build + commit**

Run: `npm run build` (expect exit 0), then:
```bash
git add src/components/Layout.jsx wrangler.toml
git commit -m "feat(nav): surface Instant Quote in nav + footer; set real WhatsApp number"
```

---

### Task 2: Concierge — prefill from URL, auto-generate, rebrand

**Files:**
- Modify: `src/pages/Concierge.jsx`

- [ ] **Step 1: Extend the React + router imports**

In `src/pages/Concierge.jsx`, change:
```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
```
to:
```jsx
import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
```

- [ ] **Step 2: Seed the form from URL params**

`TYPES` is already defined at module scope (`const TYPES = ['Wedding', 'Birthday', 'Corporate', 'Other']`). In the component, immediately after `const { fmtGhs } = useCurrency()`, add:
```jsx
  const [params] = useSearchParams()
  const paramType = TYPES.includes(params.get('type')) ? params.get('type') : 'Wedding'
  const paramBudget = Math.max(0, parseInt(params.get('budget')) || 50000)
  const paramGuests = Math.max(1, parseInt(params.get('guests')) || 150)
```
Then change the form initializer from:
```jsx
  const [form, setForm] = useState({ eventType: 'Wedding', guests: 150, budget: 50000, culture: 'Ghanaian', vibe: '' })
```
to:
```jsx
  const [form, setForm] = useState({ eventType: paramType, guests: paramGuests, budget: paramBudget, culture: 'Ghanaian', vibe: '' })
```

- [ ] **Step 3: Make `generate` callable without an event**

In `src/pages/Concierge.jsx`, the `generate` function starts with `e.preventDefault()`. Change that one line to:
```jsx
    e?.preventDefault()
```
(So it can be invoked programmatically on mount without a click event.)

- [ ] **Step 4: Auto-generate on arrival when budget+guests are present**

Immediately AFTER the `generate` function definition (after its closing `}`), add:
```jsx
  const autoRan = useRef(false)
  useEffect(() => {
    if (autoRan.current) return
    const hasBudget = parseInt(params.get('budget')) > 0
    const hasGuests = parseInt(params.get('guests')) > 0
    if (hasBudget && hasGuests) { autoRan.current = true; generate() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

- [ ] **Step 5: Rebrand the header + SEO**

Change the `<Seo .../>` and `<PageHeader .../>` block from:
```jsx
      <Seo title="Akwaaba AI Concierge" description="Describe your dream event and get an instant concept — budget breakdown, run-of-show, palette, and a vendor shortlist." />
      <PageHeader
        eyebrow="Akwaaba · AI Concierge"
        title={<>Your event, <span className="italic text-champagne-light">imagined</span> in seconds</>}
        subtitle="Tell us a little, and we'll sketch a concept — budget, timeline, palette, and vendors — to build from."
        image={img.celebrations.src}
      />
```
to:
```jsx
      <Seo title="Instant Event Package & Quote" description="Enter your budget and guest count for an instant, costed event package — budget breakdown, run-of-show, palette, and a vendor shortlist in seconds." />
      <PageHeader
        eyebrow="Instant Package & Quote"
        title={<>Your event, <span className="italic text-champagne-light">costed</span> in 60 seconds</>}
        subtitle="Tell us your budget and guest count — we'll build a full package instantly: budget breakdown, run-of-show, palette, and a vendor shortlist."
        image={img.celebrations.src}
      />
```

- [ ] **Step 6: Build + commit**

Run: `npm run build` (expect exit 0), then:
```bash
git add src/pages/Concierge.jsx
git commit -m "feat(concierge): prefill from URL, auto-generate, rebrand as Instant Quote"
```

---

### Task 3: Hero secondary CTA

**Files:**
- Modify: `src/pages/Home.jsx`

- [ ] **Step 1: Add the "Build my package" button to the hero**

In `src/pages/Home.jsx`, the hero button row is:
```jsx
        <div className="rise rise-4 mt-10 flex flex-wrap items-center gap-4">
          <Button to="/book" variant="gold" size="lg">
            Start Planning Your Event <ArrowRight size={18} />
          </Button>
          <Button to="/portfolio" variant="ghostLight" size="lg">
            View Our Work
          </Button>
        </div>
```
Change it to (insert the package CTA between the two existing buttons):
```jsx
        <div className="rise rise-4 mt-10 flex flex-wrap items-center gap-4">
          <Button to="/book" variant="gold" size="lg">
            Start Planning Your Event <ArrowRight size={18} />
          </Button>
          <Button to="/concierge" variant="ghostLight" size="lg">
            Build My Package <ArrowRight size={18} />
          </Button>
          <Button to="/portfolio" variant="ghostLight" size="lg">
            View Our Work
          </Button>
        </div>
```

- [ ] **Step 2: Build + commit**

Run: `npm run build` (expect exit 0), then:
```bash
git add src/pages/Home.jsx
git commit -m "feat(home): add Build My Package CTA to hero"
```

---

### Task 4: Interactive homepage teaser section

**Files:**
- Create: `src/components/sections/PackageTeaser.jsx`
- Modify: `src/pages/Home.jsx`

- [ ] **Step 1: Create the teaser component**

Create `src/components/sections/PackageTeaser.jsx`:
```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container } from '../ui/Section.jsx'
import Button from '../ui/Button.jsx'
import { ArrowRight } from '../../lib/icons.jsx'

const TYPES = ['Wedding', 'Birthday', 'Corporate', 'Other']

/** Interactive homepage teaser: collects type/budget/guests and hands off to the builder. */
export default function PackageTeaser() {
  const navigate = useNavigate()
  const [type, setType] = useState('Wedding')
  const [budget, setBudget] = useState(50000)
  const [guests, setGuests] = useState(150)

  const build = () => {
    const qs = new URLSearchParams({ type, budget: String(budget || 0), guests: String(guests || 0) })
    navigate(`/concierge?${qs.toString()}`)
  }

  return (
    <section className="bg-plum-deep text-cream py-20 sm:py-24">
      <Container className="max-w-3xl text-center">
        <p className="text-champagne-light text-sm tracking-[0.3em] uppercase mb-4">Instant Package &amp; Quote</p>
        <h2 className="font-display text-cream text-3xl sm:text-4xl lg:text-5xl leading-tight">
          Your event, <span className="italic text-champagne-light">costed in 60 seconds</span>
        </h2>
        <p className="mt-4 text-cream/70 leading-relaxed">
          Budget breakdown, run-of-show, and a vendor shortlist — built instantly around your numbers.
        </p>

        <div className="mt-8 rounded-3xl bg-cream/5 border border-cream/15 p-6 sm:p-8 text-left">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
            {TYPES.map((t) => (
              <button key={t} type="button" onClick={() => setType(t)} aria-pressed={type === t}
                className={`py-2.5 rounded-xl border text-sm transition-all ${type === t ? 'border-champagne bg-champagne text-plum-deep' : 'border-cream/25 text-cream/80 hover:border-cream/60'}`}>{t}</button>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="text-cream/70">Budget (GH₵)</span>
              <input type="number" min="0" inputMode="numeric" value={budget}
                onChange={(e) => setBudget(Math.max(0, parseInt(e.target.value) || 0))}
                className="mt-1 w-full rounded-xl border border-cream/25 bg-plum/40 text-cream px-3 py-2.5 outline-none focus:border-champagne" />
            </label>
            <label className="block text-sm">
              <span className="text-cream/70">Guests</span>
              <input type="number" min="1" inputMode="numeric" value={guests}
                onChange={(e) => setGuests(Math.max(0, parseInt(e.target.value) || 0))}
                className="mt-1 w-full rounded-xl border border-cream/25 bg-plum/40 text-cream px-3 py-2.5 outline-none focus:border-champagne" />
            </label>
          </div>
          <Button onClick={build} variant="gold" size="lg" className="w-full mt-6">Build My Package <ArrowRight size={18} /></Button>
          <p className="mt-3 text-center text-xs text-cream/45">Free · no signup · takes seconds</p>
        </div>
      </Container>
    </section>
  )
}
```

- [ ] **Step 2: Render it on the homepage right after the Hero**

In `src/pages/Home.jsx`, add the import alongside the other section imports (near the `Testimonials`/`RootedInGhana` imports):
```jsx
import PackageTeaser from '../components/sections/PackageTeaser.jsx'
```
Then in the `Home()` component's returned JSX, the current order is:
```jsx
      <Seo />
      <Hero />
      <Intro />
```
Change it to insert the teaser between Hero and Intro:
```jsx
      <Seo />
      <Hero />
      <PackageTeaser />
      <Intro />
```

- [ ] **Step 3: Build + commit**

Run: `npm run build` (expect exit 0), then:
```bash
git add src/components/sections/PackageTeaser.jsx src/pages/Home.jsx
git commit -m "feat(home): interactive package teaser section after hero"
```

---

### Task 5: Verify + deploy

**Files:** none (operational). Requires the correct wrangler login (**ghwmelite@gmail.com / acct ea2eb3a9…**).

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: exit 0, no errors.

- [ ] **Step 2: Deploy to production**

Run: `npx wrangler pages deploy dist --project-name gather-ghana-events --branch main`
Expected: "Deployment complete".
(No D1 migration — this change is frontend + a config var only.)

- [ ] **Step 3: Manual verification on production**

1. Homepage: the "Your event, costed in 60 seconds" teaser appears directly under the hero. Enter a budget + guests, tap **Build My Package** → lands on `/concierge` already showing a generated package (auto-run).
2. Primary nav (desktop + mobile) shows **Instant Quote** → `/concierge`.
3. Hero shows a **Build My Package** button → `/concierge`.
4. `/concierge` header reads **"Your event, costed in 60 seconds"**.
5. Generate a plan on `/concierge` → the **Chat on WhatsApp** button now appears and opens `wa.me/233505982361` with the package summary.
6. Footer WhatsApp/social link uses the real number; footer text link reads **Instant Quote**.
7. Visiting `/concierge` directly (no query params) does NOT auto-generate — the empty-state prompt shows as before.

- [ ] **Step 4: Finish the branch**

Use the `superpowers:finishing-a-development-branch` skill to merge `feat/package-spotlight` to `main` (and push if desired).

---

## Self-Review Notes

- **Spec coverage:** §1 rebrand → Task 1 (nav/footer) + Task 2 (header/SEO); §2 teaser → Task 4; §3 prefill + auto-generate → Task 2; §4 hero CTA → Task 3; §5 WhatsApp (var + footer URL) → Task 1. All covered.
- **Naming consistency:** "Instant Quote" (nav/footer, Tasks 1) and "Build My Package" (hero Task 3, teaser Task 4) and header "costed in 60 seconds" (Task 2 + teaser Task 4) are consistent across tasks. The WhatsApp number `233505982361` is identical in `wrangler.toml` and `WHATSAPP_URL` (Task 1).
- **Prefill contract:** teaser emits `?type=&budget=&guests=` (Task 4); Concierge reads exactly those keys, validates `type` against `TYPES`, clamps budget/guests, and auto-generates only when both parse `> 0` (Task 2). Consistent.
- **No-regression:** `generate` change is `e.preventDefault()` → `e?.preventDefault()` — still works for the normal form submit; auto-run guarded by a `useRef` so it fires once. Direct `/concierge` visits (no params) keep today's behavior.
- **Import paths:** `PackageTeaser.jsx` lives in `src/components/sections/`, so it imports `../ui/Section.jsx`, `../ui/Button.jsx`, `../../lib/icons.jsx` — matching the sibling `RootedInGhana.jsx` convention.
