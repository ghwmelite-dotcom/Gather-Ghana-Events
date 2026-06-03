// Paystack integration. Test or live is determined purely by the secret key.
// Docs: https://paystack.com/docs/api/transaction

import { hmacHex, safeEqual } from './util.js'

const API = 'https://api.paystack.co'

function authHeaders(env) {
  return {
    Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  }
}

export const isConfigured = (env) => Boolean(env.PAYSTACK_SECRET_KEY)

/**
 * Initialize a transaction. `amount` is in pesewas (GHS * 100).
 * Returns { authorization_url, access_code, reference } on success.
 */
export async function initialize(env, { email, amount, reference, callbackUrl, metadata }) {
  const channels = (env.PAYSTACK_CHANNELS || 'mobile_money,card')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const res = await fetch(`${API}/transaction/initialize`, {
    method: 'POST',
    headers: authHeaders(env),
    body: JSON.stringify({
      email,
      amount,
      currency: env.PAYSTACK_CURRENCY || 'GHS',
      reference,
      callback_url: callbackUrl,
      channels,
      metadata,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.status) {
    throw new Error(data.message || 'Could not start payment')
  }
  return data.data
}

/** Verify a transaction by reference. Returns Paystack's transaction data. */
export async function verify(env, reference) {
  const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: authHeaders(env),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.status) {
    throw new Error(data.message || 'Could not verify payment')
  }
  return data.data
}

/** Validate a webhook signature: HMAC-SHA512 of the raw body with the secret key. */
export async function verifyWebhook(env, rawBody, signature) {
  if (!signature) return false
  const expected = await hmacHex(env.PAYSTACK_SECRET_KEY, rawBody, 'SHA-512')
  return safeEqual(signature, expected)
}
