// Seed a believable Mensah-wedding message thread on production AND verify the
// messaging feature end-to-end (send both ways, unread badges, read clearing,
// contact-form client linking, persistent inbox replies).
// Usage: node scripts/seed-thread.mjs <org-token> <client-token>

const SITE = 'https://gge.ohwpstudios.org'
const W = 'inq_62e419a5-cd6f-4d28-bcf6-7e8d94f6947d' // Ama & Kojo Mensah wedding
const [orgToken, clientToken] = process.argv.slice(2)
if (!orgToken || !clientToken) { console.error('usage: node scripts/seed-thread.mjs <org-token> <client-token>'); process.exit(1) }

async function session(token) {
  const res = await fetch(`${SITE}/api/auth/verify`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
  })
  const data = await res.json()
  if (!res.ok || !data.ok) throw new Error(`verify failed: ${JSON.stringify(data)}`)
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0]
  console.log(`signed in: ${data.client.email}`)
  return async (path, body, method = body ? 'POST' : 'GET') => {
    const r = await fetch(`${SITE}/api${path}`, {
      method, headers: { 'Content-Type': 'application/json', cookie },
      body: body ? JSON.stringify(body) : undefined,
    })
    const d = await r.json().catch(() => null)
    if (!r.ok) throw new Error(`${path} -> ${r.status} ${JSON.stringify(d)}`)
    return d
  }
}

const assert = (cond, label) => { if (!cond) throw new Error(`ASSERT FAILED: ${label}`); console.log('  ok', label) }

const org = await session(orgToken)
const client = await session(clientToken)

// ---- conversation, interleaved with E2E assertions ----
await org('/org/thread', { inquiryId: W, body: 'Akwaaba Ama & Kojo! Wonderful news — Aburi Gardens is confirmed for 15 August. Contract signed today. 🎉' })

let t = await client(`/portal/thread?inquiry=${W}`)
assert(t.messages.length === 1 && t.messages[0].sender_role === 'organizer', 'client sees organizer message')

await client('/portal/thread', { inquiryId: W, body: 'Amazing news!! Quick one — can we add a livestream for Kojo’s family in Atlanta?' })

let ov = await org('/org/overview')
assert(ov.stats.unreadMessages === 1, 'overview shows 1 unread')
assert(ov.leads.find((l) => l.id === W)?.unread === 1, 'lead row carries the unread badge')

t = await org(`/org/thread?inquiry=${W}`)
assert(t.messages.length === 2 && t.messages[1].sender_role === 'client', 'org sees client reply (thread order ok)')

ov = await org('/org/overview')
assert(ov.stats.unreadMessages === 0, 'unread clears after org reads the thread')

await org('/org/thread', { inquiryId: W, body: 'Absolutely — I’ll add the livestream to your event page and brief the AV team. No extra venue cost.' })
await client('/portal/thread', { inquiryId: W, body: 'Perfect, medaase! We’re also loving the florals direction from Bloom & Co. 💐' })
console.log('thread: 4 messages seeded on the Mensah wedding')

// ---- contact-form client linking + persistent inbox reply ----
await fetch(`${SITE}/api/contact`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Ama Mensah', email: 'ohwpstudios+amakojo@gmail.com', message: 'Hi! Does Aburi Gardens have parking for about 60 cars?' }),
})
let inbox = await org('/org/messages')
const m = inbox.messages[0]
assert(m.client_id && m.inquiry_id === W, 'contact message linked to existing client + inquiry')

await org('/org/messages', { action: 'reply', id: m.id, body: 'Hi Ama! Yes — Aburi Gardens has parking for 80+ cars, and we’ll have ushers directing guests on the day.' })
inbox = await org('/org/messages')
assert(inbox.messages.find((x) => x.id === m.id)?.replies?.length === 1, 'inbox reply persisted with history')

// leave client messages unread so the demo shows a live badge
// (message 4 "Perfect, medaase!" is also unread — org hasn't read since)
await client('/portal/thread', { inquiryId: W, body: 'One more thing — could we taste the jollof menu before we lock catering? 😄' })
ov = await org('/org/overview')
assert(ov.stats.unreadMessages >= 1, `demo unread badge armed (${ov.stats.unreadMessages} unread from Ama)`)

console.log('\nAll messaging E2E checks passed. Demo state: live thread on /org/clients/' + W + ' with 1 unread badge on the dashboard.')
