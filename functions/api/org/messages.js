// /api/org/messages — organizer inbox for contact-form messages.
//   GET                   -> all messages with status
//   POST { action, ... }  -> reply | mark

import { ok, fail, readJson } from '../../_lib/respond.js'
import { now, clampStr, isEmail } from '../../_lib/util.js'
import { currentOrganizer } from '../../_lib/auth.js'
import { sendMessageReply } from '../../_lib/email.js'
import { logActivity } from '../../_lib/activity.js'

const STATUSES = ['new', 'read', 'replied']

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const { results } = await env.DB
    .prepare('SELECT id, name, email, body, status, replied_at, created_at FROM messages ORDER BY created_at DESC LIMIT 200')
    .all()
  return ok({ messages: results })
}

export async function onRequestPost({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const db = env.DB
  const body = await readJson(request)
  const action = body.action

  if (action === 'mark') {
    const id = clampStr(body.id, 60)
    const status = STATUSES.includes(body.status) ? body.status : null
    if (!status) return fail('Invalid status', 422)
    const r = await db.prepare('UPDATE messages SET status = ? WHERE id = ?').bind(status, id).run()
    if (!r.meta.changes) return fail('Message not found', 404)
    return ok({ id, status })
  }

  if (action === 'reply') {
    const text = clampStr(body.body, 4000)
    if (!text) return fail('Reply body required', 422)
    const msg = await db.prepare('SELECT id, name, email FROM messages WHERE id = ?').bind(clampStr(body.id, 60)).first()
    if (!msg) return fail('Message not found', 404)
    if (!isEmail(msg.email)) return fail('Stored contact email is invalid', 422)
    const sent = await sendMessageReply(env, { to: msg.email, name: msg.name, body: text, replyTo: org.email })
    if (!sent.sent) return fail('Email is not configured or failed to send', 502)
    await db.prepare('UPDATE messages SET status = ?, replied_at = ? WHERE id = ?').bind('replied', now(), msg.id).run()
    await logActivity(db, { actor: org.email, action: 'message.reply', entityType: 'message', entityId: msg.id, detail: `Replied to ${msg.name}` })
    return ok({ id: msg.id, status: 'replied' })
  }

  return fail('Unknown action', 422)
}
