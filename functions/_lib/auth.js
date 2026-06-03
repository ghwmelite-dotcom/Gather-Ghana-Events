// Session + magic-link auth. No external deps — uses Web Crypto (HMAC).
//
// Session token: base64url(JSON{cid,exp}) + "." + HMAC-SHA256 signature.
// Stored in an httpOnly, Secure, SameSite=Lax cookie so the SPA can't read it
// but the browser sends it with same-origin /api requests.

import { b64urlEncode, b64urlDecode, hmacHex, safeEqual, now } from './util.js'

const COOKIE = 'gge_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days
const MAGIC_TTL_MS = 1000 * 60 * 30 // 30 minutes

export const magicTokenTtl = () => now() + MAGIC_TTL_MS

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
