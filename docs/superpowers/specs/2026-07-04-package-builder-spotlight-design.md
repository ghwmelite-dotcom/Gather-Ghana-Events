# Package-builder spotlight — design

**Date:** 2026-07-04
**Status:** Approved (pending spec review)

## Problem & goal

The custom event-package builder (the "Akwaaba AI Concierge" at `/concierge`) is one of the
platform's strongest selling features but is effectively hidden: it appears only as a footer
link, is absent from the primary nav, and has no presence on the homepage. Goal: make it a
beautifully highlighted, easily visible key selling feature — reframed around its benefit and
fronted by an interactive homepage teaser that hands off seamlessly into a fully-generated
package.

## Decisions locked

- **Framing:** "Instant package & quote." Nav label "Instant Quote"; primary CTA "Build my
  package →"; Concierge header/SEO "Your event, costed in 60 seconds — budget, breakdown &
  vendors, instantly." No route rename (`/concierge` stays).
- **Homepage treatment:** an interactive teaser section placed immediately after the Hero.
- **Hand-off:** the teaser passes `type`/`budget`/`guests` via query params; Concierge pre-fills
  and auto-generates on load when budget+guests are present.

## Non-goals (YAGNI)

- No change to the package-generation logic (`/api/ai/concept`, `functions/_lib/packages.js`).
- No route rename or redirect; `/concierge` remains the canonical path.
- No A/B testing, analytics events, or new pages.
- No redesign of the Concierge results layout — only its header copy/branding.

## Design

### 1. Naming / rebrand (touchpoints only)
- `src/components/Layout.jsx` primary `navItems`: add `{ to: '/concierge', label: 'Instant Quote' }`
  (renders in both desktop and mobile nav, which map over the same array). Footer link label
  changes from "AI Concierge" to "Instant Quote" (same `/concierge` target).
- `src/pages/Concierge.jsx` `PageHeader` + `Seo`: retitle to the "costed in 60 seconds" framing.
  The generation form and results are unchanged.

### 2. Interactive homepage teaser
- New component `src/components/sections/PackageTeaser.jsx`: a warm-luxury (plum/champagne),
  on-brand card containing:
  - a compact event-type selector (Wedding / Birthday / Corporate / Other),
  - a **Budget (GH₵)** number input and a **Guests** number input,
  - a gold **"Build my package →"** button.
- On submit it uses `useNavigate()` to go to
  `/concierge?type=<type>&budget=<budget>&guests=<guests>` (values URL-encoded).
- Local state only (event type, budget, guests); sensible defaults (e.g. Wedding / 50000 / 150).
  No API call in the teaser itself — generation happens on the Concierge page.
- Rendered in `src/pages/Home.jsx` directly after `<Hero />` and before `<Intro />`.

### 3. Seamless hand-off (Concierge prefill + auto-generate)
- `src/pages/Concierge.jsx` reads `type`, `budget`, `guests` from `useSearchParams()` on mount.
- Initial `form` state is seeded from those params when present (validated/clamped: `type` must
  be one of the four known types else default; `budget`/`guests` parsed to positive integers),
  otherwise the current defaults.
- If both `budget` and `guests` params are present, `generate()` runs once automatically on
  mount (a `useEffect` guarded so it fires a single time), so the visitor lands on a
  fully-costed package. With no params, behavior is identical to today (nothing auto-runs).

### 4. Hero CTA
- `src/pages/Home.jsx` `Hero()`: add a secondary **"Build my package →"** button linking to
  `/concierge`, beside the existing primary "Start planning" CTA. Matches existing hero button
  styling (secondary/outline variant so it doesn't compete with the primary).

### 5. WhatsApp consistency (bundled)
- `wrangler.toml` `[vars]`: set `ORGANIZER_WHATSAPP = "233505982361"` (enables the Concierge
  "Chat on WhatsApp" hand-off button).
- `src/components/Layout.jsx`: change the placeholder `WHATSAPP_URL` from
  `https://wa.me/233000000000` to `https://wa.me/233505982361`.

## Data flow

Homepage teaser (type/budget/guests) → navigate `/concierge?…` → Concierge seeds form from
params → auto-`generate()` → `POST /api/ai/concept` → fully-costed package + hand-off card
(in-system + WhatsApp, now live). Every other entry point (nav "Instant Quote", hero CTA, footer)
lands on `/concierge` with no params → normal manual flow.

## Error handling

- Invalid/garbage query params: `type` falls back to default, non-numeric `budget`/`guests`
  fall back to defaults; auto-generate only fires when both parse to positive numbers.
- Teaser inputs are plain controlled fields; the button always navigates (Concierge clamps
  server-side as it already does).
- No new failure modes on the generation path (unchanged).

## Testing

No pure-logic changes, so verification is manual on a preview/prod deploy:
1. Homepage shows the teaser directly under the hero; entering budget+guests and tapping
   "Build my package →" lands on `/concierge` already showing a generated package.
2. "Instant Quote" appears in desktop and mobile primary nav and routes to `/concierge`.
3. Hero secondary CTA routes to `/concierge`.
4. Concierge header reads the new "costed in 60 seconds" framing.
5. The Concierge "Chat on WhatsApp" button now appears and opens `wa.me/233505982361` with the
   package summary; the footer WhatsApp link uses the real number.
6. Visiting `/concierge` directly (no params) behaves exactly as before (no auto-generate).

## Sequencing

Single implementation plan. Suggested order: WhatsApp/config + nav/footer (quick, low-risk) →
Concierge param prefill/auto-generate + rebrand → Hero CTA → homepage teaser section → build,
verify, deploy.
