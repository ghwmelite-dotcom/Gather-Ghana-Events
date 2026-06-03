// POST /api/contact — store a contact-form message.

import { ok, fail, readJson } from '../_lib/respond.js'
import { uid, now, isEmail, clampStr } from '../_lib/util.js'

export async function onRequestPost({ request, env }) {
  const body = await readJson(request)
  const name = clampStr(body.name, 120)
  const email = clampStr(body.email, 160).toLowerCase()
  const message = clampStr(body.message, 4000)

  const errors = {}
  if (!name) errors.name = 'Name is required'
  if (!isEmail(email)) errors.email = 'Valid email is required'
  if (!message) errors.message = 'Message is required'
  if (Object.keys(errors).length) return fail('Please check the form', 422, { fields: errors })

  await env.DB.prepare(
    'INSERT INTO messages (id, name, email, body, created_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(uid('msg_'), name, email, message, now())
    .run()

  return ok()
}
