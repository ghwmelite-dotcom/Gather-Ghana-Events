// Transactional email via Resend (RESEND_API_KEY). No-ops gracefully when unset.

export const emailConfigured = (env) => Boolean(env.RESEND_API_KEY)

const fromAddr = (env) => env.EMAIL_FROM || 'Gather Ghana Events <hello@gatherghana.events>'

const shell = (title, inner) => `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:auto;color:#1A1216">
    <div style="height:6px;background:linear-gradient(90deg,#C9A24B,#2B1B2E,#B5654A,#1F6B52)"></div>
    <div style="padding:28px 8px">
      <h1 style="font-family:Georgia,serif;color:#2B1B2E;font-size:24px;margin:0 0 16px">${title}</h1>
      ${inner}
      <p style="color:#9a9098;font-size:12px;margin-top:28px">Gather Ghana Events · Accra, Ghana</p>
    </div>
  </div>`

const button = (href, label) =>
  `<p style="margin:24px 0"><a href="${href}" style="background:#2B1B2E;color:#FAF6EF;padding:14px 28px;border-radius:999px;text-decoration:none">${label}</a></p>`

/** Low-level send. Returns { sent: boolean }. */
export async function sendEmail(env, { to, subject, html, replyTo }) {
  if (!emailConfigured(env) || !to) return { sent: false }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromAddr(env), to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    })
    return { sent: res.ok }
  } catch {
    return { sent: false }
  }
}

export function sendMagicLink(env, { to, link, name }) {
  return sendEmail(env, {
    to,
    subject: 'Your Gather Ghana sign-in link',
    html: shell(
      'Your sign-in link',
      `<p>Hello ${name || 'there'}, tap below to access your Gather Ghana client portal.</p>
       ${button(link, 'Open my portal')}
       <p style="color:#6b6168;font-size:13px">This link expires in 30 minutes and can be used once.
       If you didn't request it, you can safely ignore this email.</p>`
    ),
  })
}

const escHtml = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))

/** Organizer's reply to a contact-form message. */
export function sendMessageReply(env, { to, name, body, replyTo }) {
  const paragraphs = String(body)
    .split('\n')
    .map((line) => `<p>${escHtml(line) || '&nbsp;'}</p>`)
    .join('')
  return sendEmail(env, {
    to,
    replyTo,
    subject: 'Re: your message to Gather Ghana Events',
    html: shell(
      `Hello ${escHtml(name || 'there')},`,
      `${paragraphs}<p style="color:#6b6168;font-size:13px;margin-top:20px">— The Gather Ghana Events team</p>`
    ),
  })
}

/** Notify the other side of a new thread message. toPortal: true → recipient is the client. */
export function sendThreadNotice(env, { to, fromName, body, site, toPortal }) {
  const paragraphs = String(body)
    .split('\n')
    .map((line) => `<p style="color:#4b4148">${escHtml(line) || '&nbsp;'}</p>`)
    .join('')
  return sendEmail(env, {
    to,
    subject: `New message from ${fromName || (toPortal ? 'your planner' : 'a client')} — Gather Ghana Events`,
    html: shell(
      `New message from ${escHtml(fromName || (toPortal ? 'your planner' : 'a client'))}`,
      `${paragraphs}
       ${button(toPortal ? `${site}/portal` : `${site}/org`, toPortal ? 'Reply in your portal' : 'Reply on the dashboard')}
       <p style="color:#6b6168;font-size:13px">Replies are kept with your event so nothing gets lost.</p>`
    ),
  })
}

/** Confirm a new inquiry to the client and notify the organizer. */
export async function sendInquiryEmails(env, { clientEmail, clientName, type, date, site }) {
  const tasks = []
  tasks.push(
    sendEmail(env, {
      to: clientEmail,
      subject: "We've received your inquiry — Gather Ghana Events",
      html: shell(
        `Medaase, ${clientName || 'friend'}!`,
        `<p>We've received your ${String(type || 'event').toLowerCase()} inquiry${date ? ` for <strong>${date}</strong>` : ''}.
         Our team will be in touch within 24 hours with next steps.</p>
         ${button(`${site}/portal`, 'View your portal')}
         <p style="color:#6b6168;font-size:13px">You can secure your date with a deposit at any time from your portal.</p>`
      ),
    })
  )
  const orgTo = env.ORGANIZER_NOTIFY || (env.ORGANIZER_EMAILS || '').split(',')[0]?.trim()
  if (orgTo) {
    tasks.push(
      sendEmail(env, {
        to: orgTo,
        replyTo: clientEmail,
        subject: `New ${type} inquiry — ${clientName}`,
        html: shell('New inquiry', `<p><strong>${clientName}</strong> (${clientEmail})${date ? ` · ${date}` : ''}</p>
         <p>Type: ${type}</p>${button(`${site}/org`, 'Open organizer dashboard')}`),
      })
    )
  }
  await Promise.allSettled(tasks)
}
