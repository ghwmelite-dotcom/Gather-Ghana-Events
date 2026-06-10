// /api/portal/thread — the client side of their event conversation.
//   GET ?inquiry=<id>            -> { messages } (ownership-checked; marks read_by_client)
//   POST { inquiryId, body }     -> send as client; emails the organizer

import { ok, fail, readJson } from '../../_lib/respond.js'
import { uid, now, clampStr } from '../../_lib/util.js'
import { currentClientId } from '../../_lib/auth.js'
import { sendThreadNotice } from '../../_lib/email.js'
import { logActivity } from '../../_lib/activity.js'

async function ownedInquiry(db, inquiryId, clientId) {
  return db
    .prepare(
      `SELECT i.id, c.name AS client_name, c.email AS client_email
       FROM inquiries i JOIN clients c ON c.id = i.client_id
       WHERE i.id = ? AND i.client_id = ?`
    )
    .bind(inquiryId, clientId)
    .first()
}

export async function onRequestGet({ request, env }) {
  const clientId = await currentClientId(request, env)
  if (!clientId) return fail('Not signed in', 401)
  const inquiry = clampStr(new URL(request.url).searchParams.get('inquiry'), 60)
  if (!inquiry) return fail('inquiry is required', 422)
  const db = env.DB
  if (!(await ownedInquiry(db, inquiry, clientId))) return fail('Not found', 404)

  const { results } = await db
    .prepare(
      `SELECT id, sender_role, sender_email, body, read_by_org, read_by_client, created_at
       FROM thread_messages WHERE inquiry_id = ? ORDER BY created_at ASC LIMIT 200`
    )
    .bind(inquiry)
    .all()
  await db
    .prepare("UPDATE thread_messages SET read_by_client = 1 WHERE inquiry_id = ? AND sender_role = 'organizer' AND read_by_client = 0")
    .bind(inquiry)
    .run()
  return ok({ messages: results })
}

export async function onRequestPost({ request, env }) {
  const clientId = await currentClientId(request, env)
  if (!clientId) return fail('Not signed in', 401)
  const db = env.DB
  const payload = await readJson(request)
  const inquiryId = clampStr(payload.inquiryId, 60)
  const body = clampStr(payload.body, 4000)
  if (!inquiryId || !body) return fail('inquiryId and body are required', 422)

  const inquiry = await ownedInquiry(db, inquiryId, clientId)
  if (!inquiry) return fail('Not found', 404)

  const id = uid('thr_')
  await db
    .prepare(
      `INSERT INTO thread_messages (id, inquiry_id, sender_role, sender_email, body, read_by_org, read_by_client, created_at)
       VALUES (?,?,'client',?,?,0,1,?)`
    )
    .bind(id, inquiryId, inquiry.client_email, body, now())
    .run()

  const site = env.SITE_URL || new URL(request.url).origin
  const orgTo = env.ORGANIZER_NOTIFY || (env.ORGANIZER_EMAILS || '').split(',')[0]?.trim()
  if (orgTo) {
    await sendThreadNotice(env, { to: orgTo, fromName: inquiry.client_name, body, site, toPortal: false })
  }
  await logActivity(db, {
    actor: inquiry.client_email, action: 'thread.send', entityType: 'thread', entityId: id,
    inquiryId, detail: `Message from ${inquiry.client_name}`,
  })
  return ok({ id })
}
