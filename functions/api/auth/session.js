// GET /api/auth/session — returns the signed-in client (+ organizer flag), or 401.

import { json, unauthorized } from '../../_lib/respond.js'
import { currentClientId, isOrganizerEmail } from '../../_lib/auth.js'

export async function onRequestGet({ request, env }) {
  const clientId = await currentClientId(request, env)
  if (!clientId) return unauthorized()

  const client = await env.DB
    .prepare('SELECT id, email, name FROM clients WHERE id = ?')
    .bind(clientId)
    .first()
  if (!client) return unauthorized()

  return json({ ok: true, client: { ...client, isOrganizer: isOrganizerEmail(env, client.email) } })
}
