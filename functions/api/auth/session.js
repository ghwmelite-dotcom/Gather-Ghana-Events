// GET /api/auth/session — returns the signed-in client (+ organizer flag), or 401.

import { json, unauthorized } from '../../_lib/respond.js'
import { currentClientId, isOrganizer, roleOf, canWrite } from '../../_lib/auth.js'

export async function onRequestGet({ request, env }) {
  const clientId = await currentClientId(request, env)
  if (!clientId) return unauthorized()

  const client = await env.DB
    .prepare('SELECT id, email, name, is_organizer, role FROM clients WHERE id = ?')
    .bind(clientId)
    .first()
  if (!client) return unauthorized()

  return json({ ok: true, client: { id: client.id, email: client.email, name: client.name, isOrganizer: isOrganizer(env, client), role: roleOf(env, client), canWrite: canWrite(env, client) } })
}
