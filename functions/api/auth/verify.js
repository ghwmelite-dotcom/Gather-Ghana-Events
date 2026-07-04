// POST /api/auth/verify { token }
// Consumes a magic-link token and sets the session cookie.

import { json, fail, readJson } from '../../_lib/respond.js'
import { now, sha256Hex, clampStr } from '../../_lib/util.js'
import { createSession, sessionCookie, isOrganizer, roleOf, canWrite } from '../../_lib/auth.js'

export async function onRequestPost({ request, env }) {
  const { token } = await readJson(request)
  const clean = clampStr(token, 200)
  if (!clean) return fail('Missing token', 422)

  const tokenHash = await sha256Hex(clean)
  const row = await env.DB
    .prepare('SELECT client_id, expires_at, used FROM auth_tokens WHERE token_hash = ?')
    .bind(tokenHash)
    .first()

  if (!row || row.used || row.expires_at < now()) {
    return fail('This sign-in link is invalid or has expired. Request a new one.', 401)
  }

  // Single use.
  await env.DB.prepare('UPDATE auth_tokens SET used = 1 WHERE token_hash = ?').bind(tokenHash).run()

  const client = await env.DB
    .prepare('SELECT id, email, name, is_organizer, role FROM clients WHERE id = ?')
    .bind(row.client_id)
    .first()
  if (!client) return fail('Account not found', 404)

  const secret = env.SESSION_SECRET || 'dev-insecure-secret'
  const session = await createSession(client.id, secret)
  const secure = (env.SITE_URL || '').startsWith('https') || env.ENVIRONMENT === 'production'

  return json(
    { ok: true, client: { id: client.id, email: client.email, name: client.name, isOrganizer: isOrganizer(env, client), role: roleOf(env, client), canWrite: canWrite(env, client) } },
    200,
    { 'Set-Cookie': sessionCookie(session, { secure }) }
  )
}
