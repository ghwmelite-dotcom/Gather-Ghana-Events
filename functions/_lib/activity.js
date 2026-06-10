// Best-effort activity trail. Logging must never break the action it records,
// so every failure is swallowed.

import { uid, now, clampStr } from './util.js'

export async function logActivity(db, { actor, action, entityType, entityId, inquiryId, detail }) {
  try {
    await db
      .prepare(
        `INSERT INTO activity_log (id, actor_email, action, entity_type, entity_id, inquiry_id, detail, created_at)
         VALUES (?,?,?,?,?,?,?,?)`
      )
      .bind(
        uid('act_'), clampStr(actor, 160) || null, clampStr(action, 60),
        clampStr(entityType, 40) || null, clampStr(entityId, 60) || null,
        clampStr(inquiryId, 60) || null, clampStr(detail, 300) || null, now()
      )
      .run()
  } catch { /* never block the mutation being logged */ }
}
