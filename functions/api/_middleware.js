// Runs for every /api/* request: CORS allowlist, preflight, and a JSON
// error boundary so a thrown handler never leaks a stack trace to the client.

import { fail } from '../_lib/respond.js'

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin')
  if (!origin) return null
  const allow = new Set(
    [
      env.SITE_URL,
      'http://localhost:5173',
      'http://localhost:4173',
      'http://127.0.0.1:5173',
    ].filter(Boolean)
  )
  return allow.has(origin) ? origin : null
}

function corsHeaders(origin) {
  if (!origin) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

export async function onRequest(context) {
  const { request, env, next } = context
  const origin = allowedOrigin(request, env)
  const cors = corsHeaders(origin)

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  let response
  try {
    response = await next()
  } catch (err) {
    response = fail(env.ENVIRONMENT === 'production' ? 'Server error' : String(err?.message || err), 500)
  }

  // Attach CORS + a baseline of safety headers to the API response.
  const headers = new Headers(response.headers)
  for (const [k, v] of Object.entries(cors)) headers.set(k, v)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  return new Response(response.body, { status: response.status, headers })
}
