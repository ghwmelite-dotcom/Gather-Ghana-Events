// /api/portal/proposals — the signed-in client's proposals (quotes).
//   GET                          -> list
//   POST { proposalId, action }  -> accept | decline  (client's money gate)

import { ok, json, fail, readJson } from '../../_lib/respond.js'
import { currentClientId } from '../../_lib/auth.js'
import { logActivity } from '../../_lib/activity.js'

export async function onRequestGet({ request, env }) {
  const clientId = await currentClientId(request, env)
  if (!clientId) return fail('Not signed in', 401)
  const { results } = await env.DB
    .prepare(
      `SELECT p.id, p.title, p.amount, p.currency, p.status, p.body, p.created_at
       FROM proposals p JOIN inquiries i ON i.id = p.inquiry_id
       WHERE i.client_id = ? ORDER BY p.created_at DESC`
    )
    .bind(clientId)
    .all()
  return json({ ok: true, proposals: results })
}

export async function onRequestPost({ request, env }) {
  const clientId = await currentClientId(request, env)
  if (!clientId) return fail('Not signed in', 401)
  const { proposalId, action } = await readJson(request)
  const next = { accept: 'accepted', decline: 'declined' }[action]
  if (!next) return fail('Unknown action', 422)

  // Ensure the proposal belongs to this client.
  const owned = await env.DB
    .prepare(
      `SELECT p.id, p.title, p.inquiry_id, c.email AS client_email
       FROM proposals p
       JOIN inquiries i ON i.id = p.inquiry_id
       JOIN clients c ON c.id = i.client_id
       WHERE p.id = ? AND i.client_id = ?`
    )
    .bind(proposalId, clientId)
    .first()
  if (!owned) return fail('Proposal not found', 404)

  await env.DB.prepare('UPDATE proposals SET status = ? WHERE id = ?').bind(next, proposalId).run()
  await logActivity(env.DB, {
    actor: owned.client_email, action: `proposal.${next}`, entityType: 'proposal', entityId: owned.id,
    inquiryId: owned.inquiry_id, detail: `Client ${next} proposal "${owned.title}"`,
  })
  return ok({ proposalId, status: next })
}
