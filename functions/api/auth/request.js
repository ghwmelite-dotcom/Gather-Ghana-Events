// POST /api/auth/request { email }
// Issues a single-use magic link to a known client. Always returns ok so the
// endpoint never reveals which emails exist.

import { ok, fail, readJson } from '../../_lib/respond.js'
import { uid, now, sha256Hex, isEmail, clampStr } from '../../_lib/util.js'
import { magicTokenTtl } from '../../_lib/auth.js'
import { sendMagicLink, emailConfigured } from '../../_lib/email.js'

export async function onRequestPost({ request, env }) {
  const { email: raw } = await readJson(request)
  const email = clampStr(raw, 160).toLowerCase()
  if (!isEmail(email)) return fail('Enter a valid email address', 422)

  const client = await env.DB
    .prepare('SELECT id, name FROM clients WHERE email = ?')
    .bind(email)
    .first()

  // Unknown email: respond ok without sending anything.
  if (!client) return ok({ sent: true })

  // Mint a random token; store only its hash.
  const token = uid('') + uid('')
  const tokenHash = await sha256Hex(token)
  await env.DB
    .prepare(
      'INSERT INTO auth_tokens (token_hash, client_id, expires_at, used, created_at) VALUES (?, ?, ?, 0, ?)'
    )
    .bind(tokenHash, client.id, magicTokenTtl(), now())
    .run()

  const site = env.SITE_URL || new URL(request.url).origin
  const link = `${site}/login?token=${token}`

  await sendMagicLink(env, { to: email, link, name: client.name })

  // In non-production without email configured, return the link so the flow
  // is testable end to end. Never do this in production.
  const expose = env.ENVIRONMENT !== 'production' && !emailConfigured(env)
  return ok({ sent: true, ...(expose ? { devLink: link } : {}) })
}
