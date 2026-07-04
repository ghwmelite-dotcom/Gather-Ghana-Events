// POST /api/ai/concept — the "Akwaaba" concierge.
// Deterministic budget/timeline/vendor plan that ALWAYS works; an LLM (if
// configured) layers on a bespoke concept narrative + palette.

import { ok, readJson } from '../../_lib/respond.js'
import { clampStr } from '../../_lib/util.js'
import { complete, isConfigured } from '../../_lib/ai.js'
import { reweightSplit, labelToKeys, vendorCategoriesForKey, packageSummary } from '../../_lib/packages.js'

// Budget splits by event type (percentages).
const SPLITS = {
  Wedding: [['Venue & catering', 45], ['Décor, florals & interior styling', 20], ['Photography & film', 15], ['Music & entertainment', 10], ['Attire & beauty', 10]],
  Birthday: [['Venue & catering', 45], ['Décor & theme', 25], ['Entertainment', 15], ['Photography & favours', 15]],
  Corporate: [['Venue & production (AV)', 40], ['Catering', 25], ['Stage, lighting & décor', 20], ['Photography & content', 15]],
  Other: [['Venue & catering', 45], ['Décor', 25], ['Entertainment', 15], ['Photography', 15]],
}
const TIMELINE = {
  Wedding: [['2:00 PM', 'Ceremony'], ['3:30 PM', 'Cocktails & photos'], ['6:00 PM', 'Reception & dinner'], ['8:00 PM', 'Dancing']],
  Birthday: [['Arrival', 'Welcome & cocktails'], ['Main', 'Toasts, dinner & cake'], ['Late', 'Dancing']],
  Corporate: [['6:00 PM', 'Registration & networking'], ['7:00 PM', 'Programme & keynote'], ['8:30 PM', 'Dinner & entertainment'], ['9:30 PM', 'Networking close']],
  Other: [['Arrival', 'Welcome'], ['Main', 'Programme & dining'], ['Late', 'Celebration']],
}
const VENDORS = {
  Wedding: ['venue', 'catering', 'decor', 'photography', 'music', 'makeup'],
  Birthday: ['venue', 'catering', 'decor', 'music'],
  Corporate: ['venue', 'catering', 'decor', 'photography'],
  Other: ['venue', 'catering', 'decor', 'photography'],
}
const PALETTES = {
  romantic: ['#2B1B2E', '#F5ECD7', '#C9A24B', '#B5654A'],
  regal: ['#1E1320', '#C9A24B', '#3D2A41', '#E4C97E'],
  vibrant: ['#B5654A', '#C9A24B', '#1F6B52', '#2B1B2E'],
  minimal: ['#FAF6EF', '#2B1B2E', '#C9A24B', '#B5654A'],
}

const pickPalette = (vibe) => {
  const v = (vibe || '').toLowerCase()
  if (/regal|luxur|gold|grand/.test(v)) return PALETTES.regal
  if (/vibrant|color|bold|fun/.test(v)) return PALETTES.vibrant
  if (/minimal|simple|clean|modern/.test(v)) return PALETTES.minimal
  return PALETTES.romantic
}

export async function onRequestPost({ request, env }) {
  const body = await readJson(request)
  const type = ['Wedding', 'Birthday', 'Corporate', 'Other'].includes(body.eventType) ? body.eventType : 'Other'
  const guests = Math.max(1, Math.min(100000, parseInt(body.guests) || 100))
  const budget = Math.max(0, parseInt(body.budget) || 0) // whole GHS
  const vibe = clampStr(body.vibe, 200)
  const culture = clampStr(body.culture, 80)

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
           WHERE category IN (${placeholders}) AND price_from > 0 AND price_from <= ?
           ORDER BY verified DESC, rating DESC, price_from ASC LIMIT 3`
        )
        .bind(...cats, cap)
        .all()
      let rows = results
      if (!rows.length) {
        const fb = await env.DB
          .prepare(`SELECT slug, name, price_from FROM vendors WHERE category IN (${placeholders}) ORDER BY verified DESC, rating DESC, price_from ASC LIMIT 3`)
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
}
