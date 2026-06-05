# Site Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a beautiful public `/guide` page (one hub for organizers + clients) with a sticky table-of-contents, wired into the footer and both portals.

**Architecture:** Content lives in a data module (`src/lib/guide.js`); `src/pages/Guide.jsx` renders a hero, a sticky scroll-spy TOC, and icon-led sections from that data. Public route (indexable). Deep links (`/guide#organizers`, `/guide#clients`) scroll to anchors on load.

**Tech Stack:** React 18 + react-router-dom, Tailwind, existing design system (Seo/Section/Container/icons). No new dependencies.

**Deploy (manual):** `npm run build` then `CLOUDFLARE_ACCOUNT_ID=ea2eb3a9813660dfca2a60e594858538 npx wrangler pages deploy dist --project-name=gather-ghana-events --commit-dirty=true`. Every commit message ends with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Guide content data module

**Files:**
- Create: `src/lib/guide.js`

- [ ] **Step 1: Create `src/lib/guide.js`** with exactly this content (copy uses curly typography, which is safe inside single-quoted JS strings):

```js
// Content for the public /guide page. Edit the copy here — the page renders from this.
// Each group: { id, label, blurb, sections }. Each section: { id, icon, title, intro, steps?, note? }.
// `icon` must be an export name from src/lib/icons.jsx.

export const GUIDE_GROUPS = [
  {
    id: 'organizers',
    label: 'For organizers',
    blurb: 'Run the business — leads, proposals, escrow, vendors, and your team.',
    sections: [
      {
        id: 'org-signin', icon: 'Lock', title: 'Signing in & access',
        intro: 'Gather Ghana is passwordless — you sign in with a secure link sent to your email.',
        steps: [
          'Go to the Sign in page and enter your email.',
          'Open the email from us and tap “Open my portal”. The link lasts 30 minutes and works once.',
          'Organizers land on the dashboard; everyone else lands on their client portal.',
        ],
        note: 'Organizer access is granted from the Team page (below) or set by the studio.',
      },
      {
        id: 'org-leads', icon: 'Users', title: 'Leads & proposals',
        intro: 'Every booking enquiry becomes a lead on your dashboard.',
        steps: [
          'Open a lead to see the couple, event, estimate and brief.',
          'Send a proposal — a titled quote with an amount — from the lead or the client page.',
          'The client reviews it in their portal and accepts or declines.',
        ],
      },
      {
        id: 'org-escrow', icon: 'Lock', title: 'Milestones & the Gather Guarantee',
        intro: 'Milestones break the work into stages; escrow protects the money behind each one.',
        steps: [
          'On a client’s page, add a milestone with a title, due date and amount.',
          'Mark it Funded once payment is in, then Request release when the stage is done.',
          'The client taps Approve & release to pay it out — funds are held until they do.',
        ],
        note: 'That hold-until-approved promise is the “Gather Guarantee”.',
      },
      {
        id: 'org-vendors', icon: 'Building', title: 'Vendors',
        intro: 'Curate the marketplace couples browse at /vendors.',
        steps: [
          'Open Vendors from the dashboard to add, edit or remove a vendor.',
          'Toggle Verified on the vendors you trust — verified vendors appear first publicly.',
        ],
      },
      {
        id: 'org-inbox', icon: 'Mail', title: 'Inbox',
        intro: 'Messages from the contact form land in your inbox.',
        steps: [
          'Open Inbox and tap a message to read it — opening it marks it as read.',
          'Write a reply and send; it’s emailed to the sender and the message is marked replied.',
        ],
      },
      {
        id: 'org-team', icon: 'Users', title: 'Team',
        intro: 'Decide who can access the organizer portal.',
        steps: [
          'Open Team and invite an organizer by email — they receive a sign-in link.',
          'Revoke access any time. Core organizers set by the studio are permanent.',
        ],
      },
      {
        id: 'org-events', icon: 'Calendar', title: 'Event pages',
        intro: 'Give each celebration a beautiful public page.',
        steps: [
          'Create an event page from the dashboard with the couple, date and details.',
          'Share the /e/ link — guests can RSVP, view the schedule and send gifts.',
        ],
      },
    ],
  },
  {
    id: 'clients',
    label: 'For clients & guests',
    blurb: 'Plan your celebration, track payments, and let loved ones be part of it.',
    sections: [
      {
        id: 'cl-signin', icon: 'Lock', title: 'Signing in to your portal',
        intro: 'No password needed — we email you a secure sign-in link.',
        steps: [
          'Go to the Sign in page and enter the email you booked with.',
          'Open our email and tap the link to enter your portal.',
        ],
      },
      {
        id: 'cl-timeline', icon: 'CreditCard', title: 'Your timeline & payments',
        intro: 'Your portal shows your event, planning timeline and money in one place.',
        steps: [
          'Follow each milestone as your planner moves it forward.',
          'See your estimate, paid-to-date and balance; pay the balance securely by Mobile Money or card.',
        ],
      },
      {
        id: 'cl-proposals', icon: 'CheckCircle', title: 'Proposals',
        intro: 'When your planner sends a quote, it appears in your portal.',
        steps: [
          'Read the proposal and its amount.',
          'Tap Accept to move forward, or Decline.',
        ],
      },
      {
        id: 'cl-escrow', icon: 'Lock', title: 'Approving escrow releases',
        intro: 'Your payments are held safely until you’re happy.',
        steps: [
          'When a milestone is funded and release is requested, you’ll see Approve & release.',
          'Approve once the stage is done — your money is protected until then.',
        ],
      },
      {
        id: 'cl-events', icon: 'Heart', title: 'Event pages, RSVPs & gifts',
        intro: 'Your event page lets guests celebrate with you.',
        steps: [
          'Share your /e/ link so guests can RSVP and see the schedule.',
          'Guests can contribute to your gift pool; amounts can show in their currency and settle in GHS.',
        ],
      },
      {
        id: 'cl-financing', icon: 'Clock', title: 'Plan now, pay over time',
        intro: 'Spread the cost with a deposit and instalments.',
        steps: [
          'On the Book page, use the estimate widget to see a deposit (about 30%) plus monthly instalments.',
        ],
      },
    ],
  },
]
```

- [ ] **Step 2: Build** to confirm the module parses. Run `npm run build` — Expected: PASS (not imported yet, but a syntax error would fail later; this confirms the file is valid JS once imported in Task 2).

- [ ] **Step 3: Commit**
```bash
git add src/lib/guide.js
git commit -m "Guide content data module"
```

---

### Task 2: Guide page

**Files:**
- Create: `src/pages/Guide.jsx`

- [ ] **Step 1: Create `src/pages/Guide.jsx`** with exactly:

```jsx
import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import * as Icons from '../lib/icons.jsx'
import { GUIDE_GROUPS } from '../lib/guide.js'

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function Icon({ name, ...props }) {
  const C = Icons[name] || Icons.Sparkles
  return <C {...props} />
}

const scrollToId = (id) => {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })
}

export default function Guide() {
  const [active, setActive] = useState(GUIDE_GROUPS[0]?.sections[0]?.id)
  const sectionIds = useRef(GUIDE_GROUPS.flatMap((g) => g.sections.map((s) => s.id)))

  // Deep links like /guide#clients or /guide#org-escrow scroll into view on load.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id) setTimeout(() => scrollToId(id), 50)
  }, [])

  // Scroll-spy: mark the section nearest the top as active.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id) }),
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    )
    sectionIds.current.forEach((id) => {
      const el = document.getElementById(id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [])

  const onTocClick = (e, id) => {
    e.preventDefault()
    scrollToId(id)
    history.replaceState(null, '', `#${id}`)
    setActive(id)
  }

  return (
    <>
      <Seo title="Guide" description="How to use Gather Ghana Events — for organizers, clients and guests." />

      <section className="bg-plum-deep text-cream pt-32 pb-14">
        <Container>
          <p className="text-champagne-light text-sm tracking-[0.3em] uppercase mb-3">Guide</p>
          <h1 className="font-display text-4xl sm:text-5xl max-w-2xl">Everything you need to run and enjoy Gather Ghana.</h1>
          <p className="text-cream/70 mt-4 max-w-xl">A quick walkthrough of the planner dashboard and the client experience — pick a topic on the left.</p>
        </Container>
      </section>

      <Section tone="cream" pad="md">
        <Container className="grid lg:grid-cols-[230px_1fr] gap-10 items-start">
          {/* Sticky TOC (desktop) */}
          <nav aria-label="Guide contents" className="hidden lg:block lg:sticky lg:top-28">
            {GUIDE_GROUPS.map((g) => (
              <div key={g.id} className="mb-6">
                <p className="text-xs uppercase tracking-wider text-ink/40 mb-2">{g.label}</p>
                <ul className="space-y-1.5 border-l border-plum/10">
                  {g.sections.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        onClick={(e) => onTocClick(e, s.id)}
                        className={`block pl-3 -ml-px border-l-2 text-sm transition-colors ${active === s.id ? 'border-terracotta text-plum font-medium' : 'border-transparent text-ink/55 hover:text-plum'}`}
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="max-w-2xl">
            {/* Mobile TOC */}
            <details className="lg:hidden mb-8 rounded-2xl bg-cream-deep border border-plum/8 p-4">
              <summary className="font-display text-plum cursor-pointer">Contents</summary>
              <div className="mt-3 space-y-3">
                {GUIDE_GROUPS.map((g) => (
                  <div key={g.id}>
                    <p className="text-xs uppercase tracking-wider text-ink/40 mb-1">{g.label}</p>
                    <ul className="space-y-1">
                      {g.sections.map((s) => (
                        <li key={s.id}><a href={`#${s.id}`} className="text-sm text-terracotta link-underline">{s.title}</a></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>

            {GUIDE_GROUPS.map((g) => (
              <div key={g.id} id={g.id} className="mb-12 scroll-mt-28">
                <h2 className="font-display text-plum text-3xl">{g.label}</h2>
                <p className="text-ink/60 mt-1 mb-7">{g.blurb}</p>
                <div className="space-y-7">
                  {g.sections.map((s) => (
                    <section key={s.id} id={s.id} className="scroll-mt-28 rounded-3xl bg-cream-deep border border-plum/8 p-7">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="grid place-items-center w-10 h-10 rounded-full bg-plum/5 text-terracotta shrink-0">
                          <Icon name={s.icon} size={20} />
                        </span>
                        <h3 className="font-display text-plum text-xl">{s.title}</h3>
                      </div>
                      <p className="text-ink/70 leading-relaxed">{s.intro}</p>
                      {s.steps && (
                        <ol className="mt-4 space-y-2">
                          {s.steps.map((step, i) => (
                            <li key={i} className="flex gap-3 text-ink/70 text-sm leading-relaxed">
                              <span className="grid place-items-center w-5 h-5 rounded-full bg-plum text-cream text-[11px] shrink-0 mt-0.5 tnum">{i + 1}</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                      {s.note && <p className="mt-4 text-sm text-ink/55 border-t border-plum/10 pt-3 italic">{s.note}</p>}
                    </section>
                  ))}
                </div>
              </div>
            ))}

            <div className="rounded-3xl bg-plum text-cream p-7 text-center">
              <p className="font-display text-xl">Still have a question?</p>
              <p className="text-cream/70 text-sm mt-1 mb-4">We’re happy to help you plan.</p>
              <Link to="/contact" className="inline-flex items-center gap-2 rounded-full bg-champagne text-plum-deep px-5 py-2.5 text-sm hover:bg-champagne-light transition-colors">Contact us</Link>
            </div>
          </div>
        </Container>
      </Section>
    </>
  )
}
```

- [ ] **Step 2: Build.** Run `npm run build` — Expected: PASS (Guide imports guide.js + existing modules).

- [ ] **Step 3: Commit**
```bash
git add src/pages/Guide.jsx
git commit -m "Guide page with sticky TOC + scroll-spy"
```

---

### Task 3: Wire route, links, and sitemap

**Files:**
- Modify: `src/main.jsx`
- Modify: `src/components/Layout.jsx`
- Modify: `src/pages/OrgDashboard.jsx`
- Modify: `src/pages/Portal.jsx`
- Modify: `public/sitemap.xml`

- [ ] **Step 1: Route in `src/main.jsx`.** Add the import after the `import Concierge from './pages/Concierge.jsx'` line:
```jsx
import Guide from './pages/Guide.jsx'
```
Add this **public** route (NOT wrapped in ProtectedRoute) right after the `<Route path="/concierge" ... />` line:
```jsx
            <Route path="/guide" element={<Guide />} />
```

- [ ] **Step 2: Footer link in `src/components/Layout.jsx`.** Find the line:
```jsx
              <li><Link to="/concierge" className="link-underline">AI Concierge</Link></li>
```
Add immediately after it:
```jsx
              <li><Link to="/guide" className="link-underline">Guide</Link></li>
```

- [ ] **Step 3: Dashboard nav link in `src/pages/OrgDashboard.jsx`.** Find the nav (Vendors/Inbox/Team links) and add a Guide link as the last item inside the `<nav>`:
```jsx
            <Link to="/guide#organizers" className="text-sm rounded-full bg-cream/10 hover:bg-cream/20 text-cream px-4 py-1.5 transition-colors">Guide</Link>
```

- [ ] **Step 4: Help link in `src/pages/Portal.jsx`.** Find the "Message your planner" WhatsApp anchor near the end of the sidebar:
```jsx
                <a
                  href={WHATSAPP_URL}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-plum/15 py-4 text-plum hover:bg-plum/5 transition-colors text-sm"
                >
                  <WhatsApp size={18} /> Message your planner
                </a>
```
Add immediately after that closing `</a>`:
```jsx
                <Button to="/guide#clients" variant="outline" size="sm" className="w-full">Need help? Read the guide</Button>
```
(`Button` is already imported in Portal.jsx and renders a router link when given `to`.)

- [ ] **Step 5: Sitemap in `public/sitemap.xml`.** Add this line before the closing `</urlset>`:
```xml
  <url><loc>https://gge.ohwpstudios.org/guide</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
```

- [ ] **Step 6: Build.** Run `npm run build` — Expected: PASS.

- [ ] **Step 7: Commit**
```bash
git add src/main.jsx src/components/Layout.jsx src/pages/OrgDashboard.jsx src/pages/Portal.jsx public/sitemap.xml
git commit -m "Wire /guide: route, footer + dashboard + portal links, sitemap"
```

---

### Task 4: Deploy + browser verification

- [ ] **Step 1: Deploy.**
```bash
npm run build
CLOUDFLARE_ACCOUNT_ID=ea2eb3a9813660dfca2a60e594858538 npx wrangler pages deploy dist --project-name=gather-ghana-events --commit-dirty=true
```

- [ ] **Step 2: Smoke-check it serves.**
```bash
curl -sS -o nul -w "guide=%{http_code}\n" https://gge.ohwpstudios.org/guide
```
Expected: `guide=200`.

- [ ] **Step 3: Browser pass (Playwright).** Screenshot `/guide` at desktop (1280px) and mobile (390px) widths; assert the hero h1, both group headings ("For organizers", "For clients & guests"), and a sample section title render; capture console errors (the Cloudflare-Insights CSP warning is pre-existing and expected). Confirm `/guide#clients` scrolls to the clients group.

- [ ] **Step 4: Push.**
```bash
git push origin main
```

---

## Self-review notes (addressed)

- **Spec coverage:** content data (Task 1), page + sticky TOC + scroll-spy + hash-deeplink + reduced-motion (Task 2), public route + footer/dashboard/portal links + sitemap (Task 3), build/deploy/browser verify (Task 4). ✓
- **Icons:** all referenced icon names (`Lock, Users, Building, Mail, Calendar, CreditCard, CheckCircle, Heart, Clock`) exist in `src/lib/icons.jsx`; `Icon` falls back to `Sparkles` (also present) if a name is missing. ✓
- **Apostrophe safety:** all copy uses curly typography (’ “ ”) inside single-quoted strings — safe (only a straight `'` would terminate). ✓
- **No placeholders; ids consistent:** TOC links and `IntersectionObserver` both use the section `id`s defined in Task 1; group ids (`organizers`/`clients`) back the deep-link hashes. ✓
```
