// /api/org/organizers — manage who has organizer access.
//   GET                   -> { configEmails, members }
//   POST { action, ... }  -> grant | revoke | invite
// Config ORGANIZER_EMAILS are permanent (cannot be revoked from the UI).

import { ok, fail, readJson } from '../../_lib/respond.js'
import { uid, now, clampStr, isEmail } from '../../_lib/util.js'
import { currentOrganizer, isOrganizerEmail, issueMagicLink } from '../../_lib/auth.js'
import { sendMagicLink } from '../../_lib/email.js'
import { logActivity } from '../../_lib/activity.js'

const configList = (env) =>
  (env.ORGANIZER_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean)

export async function onRequestGet({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const cfg = configList(env)
  // Members = anyone with the DB role OR a config-email organizer who has a client row (has signed in).
  const where = cfg.length ? `is_organizer = 1 OR email IN (${cfg.map(() => '?').join(',')})` : 'is_organizer = 1'
  const { results } = await env.DB
    .prepare(`SELECT id, email, name, is_organizer FROM clients WHERE ${where} ORDER BY name`)
    .bind(...cfg)
    .all()
  const members = results.map((c) => ({
    clientId: c.id, email: c.email, name: c.name,
    source: isOrganizerEmail(env, c.email) ? 'config' : 'db',
    isSelf: c.id === org.id,
  }))
  return ok({ configEmails: cfg, members })
}

export async function onRequestPost({ request, env }) {
  const org = await currentOrganizer(request, env)
  if (!org) return fail('Organizer access required', 403)
  const db = env.DB
  const body = await readJson(request)
  const action = body.action

  if (action === 'grant') {
    const email = clampStr(body.email, 160).toLowerCase()
    const client = body.clientId
      ? await db.prepare('SELECT id, email FROM clients WHERE id = ?').bind(clampStr(body.clientId, 60)).first()
      : email && isEmail(email)
        ? await db.prepare('SELECT id, email FROM clients WHERE email = ?').bind(email).first()
        : null
    if (!client) return fail('No client with that email — use Invite instead', 404)
    await db.prepare('UPDATE clients SET is_organizer = 1 WHERE id = ?').bind(client.id).run()
    await logActivity(db, { actor: org.email, action: 'team.grant', entityType: 'client', entityId: client.id, detail: `Granted organizer access to ${client.email}` })
    return ok({ clientId: client.id })
  }

  if (action === 'revoke') {
    const id = clampStr(body.clientId, 60)
    const client = await db.prepare('SELECT id, email FROM clients WHERE id = ?').bind(id).first()
    if (!client) return fail('Client not found', 404)
    if (client.id === org.id) return fail('You cannot revoke your own access', 409)
    if (isOrganizerEmail(env, client.email)) return fail('This organizer is set in config and cannot be revoked here', 409)
    await db.prepare('UPDATE clients SET is_organizer = 0 WHERE id = ?').bind(id).run()
    await logActivity(db, { actor: org.email, action: 'team.revoke', entityType: 'client', entityId: id, detail: `Revoked organizer access for ${client.email}` })
    return ok({ clientId: id, revoked: true })
  }

  if (action === 'invite') {
    const email = clampStr(body.email, 160).toLowerCase()
    if (!isEmail(email)) return fail('Enter a valid email address', 422)
    const name = clampStr(body.name, 120) || email.split('@')[0]
    let client = await db.prepare('SELECT id FROM clients WHERE email = ?').bind(email).first()
    if (client) {
      await db.prepare('UPDATE clients SET is_organizer = 1 WHERE id = ?').bind(client.id).run()
    } else {
      const id = uid('cl_')
      await db.prepare('INSERT INTO clients (id, email, name, is_organizer, created_at) VALUES (?,?,?,1,?)')
        .bind(id, email, name, now()).run()
      client = { id }
    }
    const site = env.SITE_URL || new URL(request.url).origin
    const link = await issueMagicLink(env, { id: client.id }, site)
    const sent = await sendMagicLink(env, { to: email, link, name })
    await logActivity(db, { actor: org.email, action: 'team.invite', entityType: 'client', entityId: client.id, detail: `Invited ${email} to the team` })
    return ok({ clientId: client.id, invited: true, emailed: sent.sent })
  }

  return fail('Unknown action', 422)
}
