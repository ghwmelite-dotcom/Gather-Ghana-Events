// Thin API client for the Cloudflare Worker backend.
// In production the Worker is served at the same origin under /api (see wrangler.toml
// routes). For local dev against `wrangler dev`, set VITE_API_URL in .env.local.

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let res
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include', // send/receive the session cookie for the portal
      signal,
    })
  } catch {
    throw new ApiError('Network error. Please check your connection and try again.', 0)
  }

  const isJson = res.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await res.json().catch(() => null) : null

  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data)
  }
  return data
}

export const api = {
  // ---- Public ----
  createInquiry: (payload) => request('/inquiries', { method: 'POST', body: payload }),
  sendMessage: (payload) => request('/contact', { method: 'POST', body: payload }),
  initializePayment: (payload) =>
    request('/paystack/initialize', { method: 'POST', body: payload }),

  // ---- Auth (magic link) ----
  requestMagicLink: (email) => request('/auth/request', { method: 'POST', body: { email } }),
  verifyMagicLink: (token) => request('/auth/verify', { method: 'POST', body: { token } }),
  session: () => request('/auth/session'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // ---- Portal (auth required) ----
  portal: () => request('/portal/me'),
}

export { ApiError }
