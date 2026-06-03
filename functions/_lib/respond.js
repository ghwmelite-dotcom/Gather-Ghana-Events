// JSON response helpers shared across all API routes.

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  })

export const ok = (data = {}) => json({ ok: true, ...data })

export const fail = (error, status = 400, extra = {}) =>
  json({ ok: false, error, ...extra }, status)

export const notFound = () => fail('Not found', 404)
export const methodNotAllowed = () => fail('Method not allowed', 405)
export const unauthorized = (msg = 'Not signed in') => fail(msg, 401)

/** Read & parse a JSON body, tolerating empty/invalid bodies. */
export async function readJson(request) {
  try {
    return (await request.json()) || {}
  } catch {
    return {}
  }
}
