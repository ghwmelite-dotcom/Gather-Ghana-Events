# Gather Ghana Events

A full marketing + booking site **and** client portal for Gather Ghana Events (Accra) —
bespoke event planning and styling.

- **Frontend:** React + Vite + Tailwind CSS (warm editorial / luxury aesthetic)
- **Backend:** Cloudflare Pages Functions + D1 (SQLite)
- **Payments:** Paystack (Mobile Money + card)
- **Auth:** passwordless magic-link sessions (signed cookies, Web Crypto)

## What's inside

```
src/
  components/
    ui/            Button, Field, Img, Reveal, Section primitives
    sections/      Testimonials, FAQ
    Layout.jsx     nav + footer + skip link + WhatsApp FAB
    Seo.jsx        per-page <head> (title, OG, canonical)
    ProtectedRoute.jsx
  lib/
    api.js         typed client for the /api backend
    images.js      Unsplash imagery (swap for real photos later)
    content.js     marketing copy, packages, FAQs, testimonials
    icons.jsx      inline SVG icon set (no emoji)
    validate.js    form validation
    AuthContext.jsx
  pages/
    Home, Services, Portfolio, About, Contact, Book,
    Login (magic link), Portal (dashboard), NotFound

functions/         Cloudflare Pages Functions (the API, served at /api/*)
  _lib/            shared: auth, paystack, payments, email, util, respond
  api/
    inquiries.js           POST  create inquiry + start deposit checkout
    contact.js             POST  contact message
    paystack/initialize.js POST  start a payment (portal, auth)
    paystack/callback.js   GET   post-checkout redirect + reconcile
    paystack/webhook.js    POST  server-to-server confirmation (source of truth)
    auth/{request,verify,session,logout}.js   magic-link auth
    portal/me.js           GET   the signed-in client's data (auth)

schema.sql         D1 schema       seed.sql  demo portal data
wrangler.toml      Pages + D1 + vars config
public/_headers    security headers + asset caching
public/_redirects  SPA fallback (does not shadow /api/*)
```

## Run locally

### 1. Frontend only (no backend)

```bash
npm install
npm run dev          # http://localhost:5173
```

The booking form degrades gracefully when the API is unreachable (it confirms the
inquiry without taking payment), so you can develop the UI without Cloudflare running.

### 2. Full stack (with API + D1 + Paystack)

```bash
npm run build                              # produce dist/
cp .dev.vars.example .dev.vars             # then fill in PAYSTACK_SECRET_KEY + SESSION_SECRET
npx wrangler d1 execute gather-ghana --local --file=./schema.sql
npx wrangler d1 execute gather-ghana --local --file=./seed.sql      # optional demo data
npx wrangler pages dev ./dist              # http://localhost:8788 (serves site + /api)
```

Sign in to the portal locally with the seeded client **demo@gatherghana.events** —
since email isn't configured, `/api/auth/request` returns a `devLink` you can click.

## Deploy to Cloudflare Pages

> One-time setup. Replace `gather-ghana` / project name to taste.

```bash
# 0. Authenticate (opens a browser) — or set CLOUDFLARE_API_TOKEN
npx wrangler login

# 1. Create the D1 database, then paste its id into wrangler.toml (database_id)
npx wrangler d1 create gather-ghana

# 2. Apply the schema to the REMOTE database
npx wrangler d1 execute gather-ghana --remote --file=./schema.sql
#    optional demo data:
npx wrangler d1 execute gather-ghana --remote --file=./seed.sql

# 3. Create the Pages project (first deploy creates it)
npm run build
npx wrangler pages deploy ./dist --project-name=gather-ghana-events

# 4. Set production secrets (per project)
printf '%s' "sk_live_xxx"  | npx wrangler pages secret put PAYSTACK_SECRET_KEY --project-name=gather-ghana-events
printf '%s' "$(openssl rand -hex 32)" | npx wrangler pages secret put SESSION_SECRET --project-name=gather-ghana-events
#    optional — enables real magic-link emails:
printf '%s' "re_xxx" | npx wrangler pages secret put RESEND_API_KEY --project-name=gather-ghana-events

# 5. In the Cloudflare dashboard → Pages → Settings → Variables, set:
#    ENVIRONMENT = production
#    SITE_URL    = https://<your-domain>     (used for Paystack callbacks + magic links)
```

### Connect the D1 binding to Pages

The `wrangler.toml` `[[d1_databases]]` block binds `DB` for `wrangler pages dev/deploy`.
Confirm the binding also exists in **dashboard → Pages → Settings → Functions → D1 bindings**
(binding name `DB`) for production.

### Paystack webhook

In the Paystack dashboard → Settings → API Keys & Webhooks, set the webhook URL to:

```
https://<your-domain>/api/paystack/webhook
```

The webhook is the source of truth for payment confirmation (verified by signature),
so bookings still reconcile even if the customer closes the tab before redirect.

### Git-connected deploys (optional)

Instead of `wrangler pages deploy`, connect the GitHub repo in the Cloudflare dashboard:
build command `npm run build`, output directory `dist`. Pushes to `main` deploy
production; other branches get preview URLs.

## Environment / secrets reference

| Name | Where | Purpose |
|------|-------|---------|
| `PAYSTACK_SECRET_KEY` | secret | Paystack API (test `sk_test_…` / live `sk_live_…`) |
| `SESSION_SECRET` | secret | HMAC key for signed session cookies |
| `RESEND_API_KEY` | secret (optional) | Sends magic-link emails (else dev link only) |
| `EMAIL_FROM` | var (optional) | From address for emails |
| `SITE_URL` | var | Public origin — Paystack callback + magic-link base |
| `ENVIRONMENT` | var | `production` hides dev links & error details |
| `PAYSTACK_CURRENCY` | var | Defaults to `GHS` |
| `PAYSTACK_CHANNELS` | var | Defaults to `mobile_money,card` |

## Customising

- **Real photography:** replace the Unsplash URLs in `src/lib/images.js` (keep the keys).
- **Pricing & copy:** `src/lib/content.js`.
- **Contact details:** `WHATSAPP_URL` / `EMAIL` in `src/components/Layout.jsx`,
  `src/pages/Contact.jsx`, and `src/pages/Portal.jsx`.

---

Design system reference: `design-system/gather-ghana-events/MASTER.md`.
Crafted by Hodges &amp; Co. · ohwpstudios.org
