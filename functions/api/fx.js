// GET /api/fx — indicative FX rates for display pricing (the diaspora bridge).

import { json } from '../_lib/respond.js'
import { ratesPayload } from '../_lib/fx.js'

export async function onRequestGet() {
  return json({ ok: true, ...ratesPayload() }, 200, {
    'Cache-Control': 'public, max-age=3600',
  })
}
