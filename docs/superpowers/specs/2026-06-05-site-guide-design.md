# Site Guide (`/guide`) — Design

**Date:** 2026-06-05
**Status:** Approved (design)
**Goal:** A beautiful, on-brand, public **user guide** for Gather Ghana Events — one hub covering
both organizers and clients/guests — placed at `/guide`, with a sticky table-of-contents and
contextual links from the portals and footer.

## Audience & placement (decided)

- **Audience:** Everyone — two top-level parts: **For Organizers** (`#organizers`) and
  **For Clients & Guests** (`#clients`).
- **Placement:** Public, indexable page at `/guide` (in `sitemap.xml`). Reachable from:
  - Site **footer** (EXPLORE column) — a "Guide" link.
  - `/org` dashboard **quick-links nav** — a "Guide" link (→ `/guide#organizers`).
  - Client `/portal` — a small "Need help?" link (→ `/guide#clients`).
- **Format:** Long-form single page with a **sticky left TOC** (desktop) + lightweight scroll-spy;
  TOC collapses to a top list on mobile.

## Architecture

- **Content as data:** `src/lib/guide.js` exports an ordered array of **groups**, each group =
  `{ id, label, blurb, sections: [...] }`, each section =
  `{ id, icon, title, intro, steps?: string[], note?: string }`. Two groups: `organizers`, `clients`.
  Keeping content in a data module keeps `Guide.jsx` simple and the copy editable in one place.
- **Page:** `src/pages/Guide.jsx` renders the hero, the TOC (derived from the data — group labels
  with nested section links), and the sections. A small in-file `TocLink`/`GuideSection` helper is
  fine; no new shared components needed. Reuses `Seo`, `Section`, `Container`, the icon set, and the
  existing design tokens.
- **Scroll-spy:** a single `IntersectionObserver` over the section elements sets the active TOC id.
  Anchor clicks smooth-scroll **unless** `prefers-reduced-motion` (then instant). No external libs.
- **Routing/links:** public `<Route path="/guide">` in `main.jsx` (NOT under `ProtectedRoute`);
  footer link in `Layout.jsx`; nav link in `OrgDashboard.jsx`; help link in `Portal.jsx`;
  `/guide` row added to `public/sitemap.xml`.

## Content outline (concise — one intro line + a few steps/notes per section)

**For Organizers** (`#organizers`)
1. **Signing in & access** (icon: Lock) — passwordless magic link; organizer access via the team
   list / `ORGANIZER_EMAILS`. Steps: go to /login → enter email → click the emailed link → land on
   the dashboard.
2. **Leads & proposals** (Users) — every booking inquiry appears under Leads; open a client to see
   detail; send a proposal (quote) the client accepts or declines.
3. **Milestones & the Gather Guarantee** (Lock) — explain escrow: you add a milestone with an amount,
   mark it **funded**, then **request release**; the **client approves** to release. Funds are held
   until the client approves — that's the guarantee.
4. **Vendors** (a marketplace icon) — add/edit vendors, set the **Verified** badge; verified vendors
   rank first on the public `/vendors` directory.
5. **Inbox** (Mail) — contact-form messages arrive here; open one to read, reply (the reply is
   emailed to the sender), status moves new → read → replied.
6. **Team** (Users) — invite an organizer by email (they get a sign-in link) or revoke access;
   config organizers are permanent.
7. **Event pages** (Calendar) — create a public event page (RSVP, schedule, gallery, contributions)
   from the dashboard; share the `/e/:slug` link.

**For Clients & Guests** (`#clients`)
1. **Signing in to your portal** (Lock) — same magic-link flow; your portal shows your event.
2. **Your timeline & payments** (Calendar/CreditCard) — see milestones, paid-to-date, balance; pay
   the balance securely (Mobile Money & card via Paystack).
3. **Proposals** (CheckCircle) — review a quote from your planner and Accept or Decline.
4. **Approving escrow releases** (Lock) — when a milestone is funded and release is requested, you
   **Approve & release** — your money is protected until you do.
5. **Event pages, RSVP & gifts** (Heart) — guests RSVP and send contributions toward your pool;
   amounts can display in multiple currencies (settles in GHS).
6. **Plan now, pay over time** (CreditCard) — financing splits the cost into a deposit (~30%) plus
   installments; the estimate widget is on the Book page.

> Copy is written warm and plain (brand voice). No screenshots (they'd go stale) — icon-led sections.

## Accessibility & polish

- AA contrast, 44px touch targets, focus-visible states on TOC links and anchors.
- `aria-label` on the TOC `<nav>`; sections are `<section id=...>` with headings; "skip to" not
  needed (short page) but TOC acts as on-page nav.
- Entrance animation minimal and `prefers-reduced-motion`-gated.

## Out of scope

- Search, versioning, per-topic pages, screenshots, video, i18n. (YAGNI.)

## Testing / verification

- `npm run build` passes; `/guide` route resolves; footer/portal/dashboard links navigate and
  deep-link to the right anchor; TOC scroll-spy highlights on scroll; reduced-motion path works.
- Final browser pass (Playwright) screenshotting `/guide` desktop + mobile widths.
