// /api/org/proposals — organizer creates/lists proposals (quotes) for a lead.
//   POST { inquiryId, title, amount (whole GHS), body }
//   GET  ?inquiryId=...

import { ok, json, fail, readJson } from '../../_lib/respond.js'
import { uid, now, clampStr } from '../../_lib/util.js'
import { currentOrganizer } from '../../_lib/auth.js'
import { toMinor, formatMoney } from '../../_lib/money.js'
import { logActivity } from '../../_lib/activity.js'

export async function onRequestPost({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)

  const body = await readJson(request)
  const inquiryId = clampStr(body.inquiryId, 60)
  const title = clampStr(body.title, 160)
  if (!inquiryId || !title) return fail('inquiryId and title are required', 422)

  const id = uid('prop_')
  const amount = toMinor(parseFloat(body.amount) || 0, 'GHS')
  await env.DB
    .prepare(
      `INSERT INTO proposals (id, inquiry_id, organizer_email, title, amount, currency, body, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'GHS', ?, 'sent', ?)`
    )
    .bind(id, inquiryId, org.email, title, amount, clampStr(body.body, 4000), now())
    .run()
  await logActivity(env.DB, {
    actor: org.email, action: 'proposal.send', entityType: 'proposal', entityId: id,
    inquiryId, detail: `Proposal "${title}" sent (${formatMoney(amount, 'GHS')})`,
  })
  return ok({ id })
}

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const inquiryId = new URL(request.url).searchParams.get('inquiryId')
  const stmt = inquiryId
    ? env.DB.prepare('SELECT id, inquiry_id, title, amount, currency, status, created_at FROM proposals WHERE inquiry_id = ? ORDER BY created_at DESC').bind(inquiryId)
    : env.DB.prepare('SELECT id, inquiry_id, title, amount, currency, status, created_at FROM proposals ORDER BY created_at DESC LIMIT 50')
  const { results } = await stmt.all()
  return json({ ok: true, proposals: results })
}
