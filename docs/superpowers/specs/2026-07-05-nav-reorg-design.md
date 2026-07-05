# Top nav reorganization — design

**Date:** 2026-07-05
**Status:** Approved (pending spec review)

## Problem & goal

The primary desktop nav has grown to seven flat text links (Home, Services, Vendors, Instant
Quote, Portfolio, About, Contact) plus a currency selector and the Start Planning CTA — crowded,
and it gives the conversion feature ("Instant Quote") no visual priority. Goal: a calmer, more
premium nav that curates the visible links, elevates Instant Quote, and tucks lower-priority
company links under a refined "More" dropdown — without changing routes or the header's
hero/scrolled color behavior.

## Decisions locked

- **Drop the "Home" text link** everywhere in the nav (the logo already links home). Home stays in
  the footer sitemap.
- **Primary links:** Services · Vendors · Portfolio.
- **Instant Quote** is a dedicated, highlighted item (spark icon + champagne accent).
- **"More" dropdown** holds About · Contact.
- Currency selector + Start Planning CTA unchanged.

## Non-goals (YAGNI)

- No mega-menu / expanding category panels.
- No new routes, pages, or backend changes.
- No change to the header's scroll listener, `onHero` logic, or color-state system.
- No icons added to the plain primary links.

## Design

### Data
Replace the single `navItems` array in `src/components/Layout.jsx` with:
```js
const primaryNav = [
  { to: '/services', label: 'Services' },
  { to: '/vendors', label: 'Vendors' },
  { to: '/portfolio', label: 'Portfolio' },
]
const moreNav = [
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]
```
Instant Quote (`/concierge`) is rendered explicitly, not from an array.

### Desktop nav (md+)
Order inside the existing `<nav aria-label="Primary">`:
1. `primaryNav` links — unchanged `NavLink` styling (adapts to `onHero`/scrolled).
2. **Instant Quote** — a `NavLink` to `/concierge` with a leading `Sparkles` icon and an accent that
   stays high-contrast in both states: `text-champagne-light` when `onHero` (over the dark hero),
   and `text-terracotta` when scrolled (over the cream bar — champagne would be too light on cream).
   Slightly heavier weight (`font-medium`) and keeps the `link-underline` hover. It is visually the
   "special" link but not a filled button (so it doesn't compete with Start Planning).
3. **More ▾** — a `MoreMenu` dropdown (see below) containing `moreNav`.
4. `CurrencySelect` (unchanged).
5. Start Planning CTA (unchanged).

### `MoreMenu` component (new, in Layout.jsx)
- A button labelled **More** with a chevron (`ChevronDown` if available in `icons.jsx`; otherwise a
  small inline `▾`), styled like the other nav links and color-adapting via a `light` prop.
- Toggles a dropdown panel positioned absolutely below it. The panel is a **solid cream card**
  (`bg-cream`, `border-plum/10`, rounded, shadow) with plum links — legible over any hero, so it
  does not need color adaptation.
- Accessibility: button has `aria-haspopup="true"` and `aria-expanded={open}`; the panel links are
  focusable; pressing **Escape** closes it; a click **outside** the component closes it (via a
  `mousedown` document listener + a ref); it also closes on **route change** (`pathname` effect).
- Self-contained state (`useState`/`useRef`/`useEffect`) inside the component; does not touch the
  header's mobile `open` state.

### Mobile panel
The existing mobile `<nav id="mobile-menu">` is restructured (vertical space is ample, so no
collapsible sub-menu):
1. `primaryNav` links (current mobile styling).
2. **Instant Quote** — same large mobile link style plus the `Sparkles` icon and terracotta/italic
   accent so it stands out.
3. A subtle **"More"** label/divider (small uppercase `text-ink/40`), then the `moreNav` links.
4. Start Planning CTA (unchanged).
"Home" is dropped here too.

### Footer
The footer currently does `{navItems.map(...)}` and *also* has a hardcoded Instant Quote `<li>`,
so Instant Quote appears twice. Fix: the footer maps an explicit
`[{to:'/',label:'Home'}, ...primaryNav, ...moreNav]` (Home · Services · Vendors · Portfolio ·
About · Contact) and keeps its existing hardcoded extras (Playbooks, Instant Quote, Guide, Start
Planning, Client Portal) — no duplication.

## Accessibility

- Dropdown: `aria-haspopup`, `aria-expanded`, Escape-to-close, outside-click-close, focusable menu
  links, visible focus states (inherit existing `link-underline`/focus styles).
- All interactive targets remain ≥ the existing sizes; contrast: champagne accent on the plum hero
  and the gold-on-cream scrolled state both meet AA (already used for the CTA/eyebrows elsewhere).
- Respects existing reduced-motion posture (dropdown uses the existing `animate-fade-in` utility,
  which is already gated by the project's motion settings).

## Testing

Pure presentational/interaction change — no unit-testable logic. Verify by `npm run build` +
manual smoke test on a deploy:
1. Desktop over a hero and after scrolling: Services/Vendors/Portfolio present; Instant Quote shows
   the spark + accent; "Home" is gone; currency + Start Planning intact.
2. "More" opens on click, shows About + Contact, closes on outside-click, Escape, and on navigating.
3. Keyboard: Tab to More, Enter/Space opens, Escape closes.
4. Mobile: hamburger panel shows the grouped structure with the "More" divider and highlighted
   Instant Quote; Start Planning CTA present.
5. Footer lists each page once (no duplicate Instant Quote).

## Sequencing

Single implementation plan, all within `src/components/Layout.jsx`: data arrays → `MoreMenu`
component → desktop nav → mobile panel → footer dedup → build, verify, deploy.
