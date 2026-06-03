// POST /api/auth/logout — clears the session cookie.

import { json } from '../../_lib/respond.js'
import { clearCookie } from '../../_lib/auth.js'

export async function onRequestPost({ env }) {
  const secure = (env.SITE_URL || '').startsWith('https') || env.ENVIRONMENT === 'production'
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie({ secure }) })
}
