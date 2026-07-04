// Session + magic-link auth. No external deps — uses Web Crypto (HMAC).
//
// Session token: base64url(JSON{cid,exp}) + "." + HMAC-SHA256 signature.
// Stored in an httpOnly, Secure, SameSite=Lax cookie so the SPA can't read it
// but the browser sends it with same-origin /api requests.

import { b64urlEncode, b64urlDecode, hmacHex, safeEqual, now, uid, sha256Hex } from './util.js'

const COOKIE = 'gge_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days
const MAGIC_TTL_MS = 1000 * 60 * 30 // 30 minutes

const magicTokenTtl = () => now() + MAGIC_TTL_MS

/** Create a signed session token for a client id. */
export async function createSession(clientId, secret) {
  const payload = b64urlEncode(JSON.stringify({ cid: clientId, exp: now() + SESSION_TTL_MS }))
  const sig = await hmacHex(secret, payload)
  return `${payload}.${sig}`
}

/** Verify a session token; returns clientId or null. */
export async function readSession(token, secret) {
  if (!token || !token.includes('.')) return null
  const [payload, sig] = token.split('.')
  const expected = await hmacHex(secret, payload)
  if (!safeEqual(sig, expected)) return null
  try {
    const { cid, exp } = JSON.parse(b64urlDecode(payload))
    if (!cid || !exp || exp < now()) return null
    return cid
  } catch {
    return null
  }
}

export function sessionCookie(token, { secure = true } = {}) {
  const parts = [
    `${COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function clearCookie({ secure = true } = {}) {
  const parts = [`${COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function getCookie(request, name = COOKIE) {
  const header = request.headers.get('Cookie') || ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return null
}

/** Resolve the signed-in client id from the request, or null. */
export async function currentClientId(request, env) {
  const token = getCookie(request)
  if (!token) return null
  return readSession(token, env.SESSION_SECRET || 'dev-insecure-secret')
}

/** Is this email an organizer/admin? Configured via ORGANIZER_EMAILS (comma list). */
export function isOrganizerEmail(env, email) {
  if (!email) return false
  const list = (env.ORGANIZER_EMAILS || 'demo@gatherghana.events,hello@gatherghana.events')
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return list.includes(email.toLowerCase())
}

/** True if this client is an organizer — config bootstrap OR the DB role. */
export function isOrganizer(env, client) {
  if (!client) return false
  return isOrganizerEmail(env, client.email) || client.is_organizer === 1
}

/** Effective role for an organizer: config admins are always 'admin'; else the DB role. */
export function roleOf(env, client) {
  if (!client) return 'viewer'
  if (isOrganizerEmail(env, client.email)) return 'admin'
  return client.role === 'viewer' ? 'viewer' : 'admin'
}

/** Can this client perform write actions in /org? Organizer AND not a viewer. */
export function canWrite(env, client) {
  return isOrganizer(env, client) && roleOf(env, client) !== 'viewer'
}

/** Mint a single-use magic link for a client (only client.id is required); stores only the token hash. */
export async function issueMagicLink(env, client, site) {
  const token = uid('') + uid('')
  const tokenHash = await sha256Hex(token)
  await env.DB
    .prepare('INSERT INTO auth_tokens (token_hash, client_id, expires_at, used, created_at) VALUES (?, ?, ?, 0, ?)')
    .bind(tokenHash, client.id, magicTokenTtl(), now())
    .run()
  return `${site}/login?token=${token}`
}

/** Resolve the signed-in organizer (id, email, name, role), or null if not an organizer. */
export async function currentOrganizer(request, env) {
  const clientId = await currentClientId(request, env)
  if (!clientId) return null
  const client = await env.DB.prepare('SELECT id, email, name, is_organizer, role FROM clients WHERE id = ?').bind(clientId).first()
  if (!client || !isOrganizer(env, client)) return null
  return client
}

/** Resolve the signed-in organizer only if they may write (not a viewer); else null. */
export async function currentEditor(request, env) {
  const org = await currentOrganizer(request, env)
  if (!org || !canWrite(env, org)) return null
  return org
}
