// Small runtime helpers (Web Crypto, ids, validation) for the Worker.

export const now = () => Date.now()
export const uid = (prefix = '') => prefix + crypto.randomUUID()

const enc = new TextEncoder()

const toHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** SHA-256 hex digest of a string (used to store magic-link tokens). */
export async function sha256Hex(input) {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(input)))
}

async function hmacKey(secret, hash = 'SHA-256') {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash },
    false,
    ['sign', 'verify']
  )
}

export async function hmacHex(secret, message, hash = 'SHA-256') {
  const key = await hmacKey(secret, hash)
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
}

/** Constant-time-ish string comparison. */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// base64url helpers for the session token payload.
export const b64urlEncode = (str) =>
  btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const b64urlDecode = (str) =>
  atob(str.replace(/-/g, '+').replace(/_/g, '/'))

export const isEmail = (v) =>
  typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

export const clampStr = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** URL slug: lowercase, non-alphanumerics → single hyphens, trimmed. */
export const slugify = (v) =>
  (typeof v === 'string' ? v : '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
