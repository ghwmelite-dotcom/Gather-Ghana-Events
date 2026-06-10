// /api/org/thread — the organizer side of a per-event client conversation.
//   GET ?inquiry=<id>            -> { messages } (oldest first; marks read_by_org)
//   POST { inquiryId, body }     -> send as organizer; emails the client

import { ok, fail, readJson } from '../../_lib/respond.js'
import { uid, now, clampStr } from '../../_lib/util.js'
import { currentOrganizer } from '../../_lib/auth.js'
import { sendThreadNotice } from '../../_lib/email.js'
import { logActivity } from '../../_lib/activity.js'

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const inquiry = clampStr(new URL(request.url).searchParams.get('inquiry'), 60)
  if (!inquiry) return fail('inquiry is required', 422)
  const db = env.DB

  const { results } = await db
    .prepare(
      `SELECT id, sender_role, sender_email, body, read_by_org, read_by_client, created_at
       FROM thread_messages WHERE inquiry_id = ? ORDER BY created_at ASC LIMIT 200`
    )
    .bind(inquiry)
    .all()
  await db
    .prepare("UPDATE thread_messages SET read_by_org = 1 WHERE inquiry_id = ? AND sender_role = 'client' AND read_by_org = 0")
    .bind(inquiry)
    .run()
  return ok({ messages: results })
}

export async function onRequestPost({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const db = env.DB
  const payload = await readJson(request)
  const inquiryId = clampStr(payload.inquiryId, 60)
  const body = clampStr(payload.body, 4000)
  if (!inquiryId || !body) return fail('inquiryId and body are required', 422)

  const inquiry = await db
    .prepare(
      `SELECT i.id, c.name AS client_name, c.email AS client_email
       FROM inquiries i JOIN clients c ON c.id = i.client_id WHERE i.id = ?`
    )
    .bind(inquiryId)
    .first()
  if (!inquiry) return fail('Inquiry not found', 404)

  const id = uid('thr_')
  await db
    .prepare(
      `INSERT INTO thread_messages (id, inquiry_id, sender_role, sender_email, body, read_by_org, read_by_client, created_at)
       VALUES (?,?,'organizer',?,?,1,0,?)`
    )
    .bind(id, inquiryId, org.email, body, now())
    .run()

  const site = env.SITE_URL || new URL(request.url).origin
  await sendThreadNotice(env, {
    to: inquiry.client_email, fromName: org.name || 'your planner', body, site, toPortal: true,
  })
  await logActivity(db, {
    actor: org.email, action: 'thread.send', entityType: 'thread', entityId: id,
    inquiryId, detail: `Message to ${inquiry.client_name}`,
  })
  return ok({ id })
}
