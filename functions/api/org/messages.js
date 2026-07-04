// /api/org/messages — organizer inbox for contact-form messages.
//   GET                   -> all messages with status
//   POST { action, ... }  -> reply | mark

import { ok, fail, readJson } from '../../_lib/respond.js'
import { uid, now, clampStr, isEmail } from '../../_lib/util.js'
import { currentOrganizer, currentEditor } from '../../_lib/auth.js'
import { sendMessageReply } from '../../_lib/email.js'
import { logActivity } from '../../_lib/activity.js'

const STATUSES = ['new', 'read', 'replied']

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const db = env.DB
  const [msgs, replies] = await Promise.all([
    db.prepare(
      `SELECT m.id, m.name, m.email, m.body, m.status, m.replied_at, m.created_at, m.client_id,
              (SELECT i.id FROM inquiries i WHERE i.client_id = m.client_id ORDER BY i.created_at DESC LIMIT 1) AS inquiry_id
       FROM messages m ORDER BY m.created_at DESC LIMIT 200`
    ).all(),
    db.prepare(
      `SELECT r.id, r.message_id, r.author_email, r.body, r.created_at
       FROM message_replies r JOIN messages m ON m.id = r.message_id
       ORDER BY r.created_at ASC`
    ).all(),
  ])
  const byMessage = new Map()
  for (const r of replies.results) {
    if (!byMessage.has(r.message_id)) byMessage.set(r.message_id, [])
    byMessage.get(r.message_id).push(r)
  }
  return ok({ messages: msgs.results.map((m) => ({ ...m, replies: byMessage.get(m.id) || [] })) })
}

export async function onRequestPost({ request, env }) {
  const org = await currentEditor(request, env)
  if (!org) return fail("Read-only access — this action isn't available.", 403)
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
    await db.prepare('INSERT INTO message_replies (id, message_id, author_email, body, created_at) VALUES (?,?,?,?,?)')
      .bind(uid('rep_'), msg.id, org.email, text, now()).run()
    await db.prepare('UPDATE messages SET status = ?, replied_at = ? WHERE id = ?').bind('replied', now(), msg.id).run()
    await logActivity(db, { actor: org.email, action: 'message.reply', entityType: 'message', entityId: msg.id, detail: `Replied to ${msg.name}` })
    return ok({ id: msg.id, status: 'replied' })
  }

  return fail('Unknown action', 422)
}
