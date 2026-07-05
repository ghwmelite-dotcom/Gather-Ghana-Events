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
  milestoneAction: (milestoneId, action) =>
    request('/portal/milestones', { method: 'POST', body: { milestoneId, action } }),

  // ---- Events (public + create) ----
  event: (slug) => request(`/events/${encodeURIComponent(slug)}`),
  rsvp: (slug, payload) => request(`/events/${encodeURIComponent(slug)}/rsvp`, { method: 'POST', body: payload }),
  contribute: (slug, payload) =>
    request(`/events/${encodeURIComponent(slug)}/contribute`, { method: 'POST', body: payload }),
  createEvent: (payload) => request('/events', { method: 'POST', body: payload }),

  // ---- FX (public) ----
  fx: () => request('/fx'),

  // ---- Vendor marketplace ----
  vendors: (query = {}) => {
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v)).toString()
    return request(`/vendors${qs ? `?${qs}` : ''}`)
  },
  vendor: (slug) => request(`/vendors/${encodeURIComponent(slug)}`),
  reviewVendor: (slug, payload) =>
    request(`/vendors/${encodeURIComponent(slug)}/reviews`, { method: 'POST', body: payload }),

  // ---- AI concierge (public) ----
  concept: (payload) => request('/ai/concept', { method: 'POST', body: payload }),

  // ---- Organizer OS (organizer auth) ----
  orgOverview: () => request('/org/overview'),
  orgClient: (id) => request(`/org/clients/${encodeURIComponent(id)}`),
  createProposal: (payload) => request('/org/proposals', { method: 'POST', body: payload }),
  orgMilestone: (payload) => request('/org/milestones', { method: 'POST', body: payload }),
  orgInquiryStatus: (inquiryId, status) => request('/org/inquiry', { method: 'POST', body: { inquiryId, status } }),
  orgVendors: () => request('/org/vendors'),
  orgVendorAction: (payload) => request('/org/vendors', { method: 'POST', body: payload }),
  orgMessages: () => request('/org/messages'),
  orgMessageAction: (payload) => request('/org/messages', { method: 'POST', body: payload }),
  orgOrganizers: () => request('/org/organizers'),
  orgOrganizerAction: (payload) => request('/org/organizers', { method: 'POST', body: payload }),
  orgTasks: (query = {}) => {
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v)).toString()
    return request(`/org/tasks${qs ? `?${qs}` : ''}`)
  },
  orgTaskAction: (payload) => request('/org/tasks', { method: 'POST', body: payload }),
  orgExpenses: (query = {}) => {
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v)).toString()
    return request(`/org/expenses${qs ? `?${qs}` : ''}`)
  },
  orgExpenseAction: (payload) => request('/org/expenses', { method: 'POST', body: payload }),
  orgBooks: () => request('/org/books'),
  orgThread: (inquiry) => request(`/org/thread?inquiry=${encodeURIComponent(inquiry)}`),
  orgThreadSend: (payload) => request('/org/thread', { method: 'POST', body: payload }),
  portalThread: (inquiry) => request(`/portal/thread?inquiry=${encodeURIComponent(inquiry)}`),
  portalThreadSend: (payload) => request('/portal/thread', { method: 'POST', body: payload }),
  orgActivity: (query = {}) => {
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v)).toString()
    return request(`/org/activity${qs ? `?${qs}` : ''}`)
  },
  orgEvents: () => request('/org/events'),
  orgEventAction: (payload) => request('/org/events', { method: 'POST', body: payload }),
  services: () => request('/services'),
  orgServices: () => request('/org/services'),
  orgServiceAction: (payload) => request('/org/services', { method: 'POST', body: payload }),
  content: () => request('/content'),
  orgContent: () => request('/org/content'),
  orgContentAction: (payload) => request('/org/content', { method: 'POST', body: payload }),

  // ---- Proposals (client accepts/declines) ----
  proposalAction: (proposalId, action) => request('/portal/proposals', { method: 'POST', body: { proposalId, action } }),

  // ---- Financing (public) ----
  financingPlan: (payload) => request('/financing/plan', { method: 'POST', body: payload }),
}

export { ApiError }
