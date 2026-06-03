// Transactional email. Uses Resend if RESEND_API_KEY is set; otherwise no-ops
// and lets the caller fall back to returning a dev link (non-production only).

export const emailConfigured = (env) => Boolean(env.RESEND_API_KEY)

export async function sendMagicLink(env, { to, link, name }) {
  if (!emailConfigured(env)) return { sent: false }

  const from = env.EMAIL_FROM || 'Gather Ghana Events <hello@gatherghana.events>'
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:auto;color:#1A1216">
      <h1 style="font-family:Georgia,serif;color:#2B1B2E;font-size:24px">Your sign-in link</h1>
      <p>Hello ${name || 'there'}, tap below to access your Gather Ghana client portal.</p>
      <p style="margin:28px 0">
        <a href="${link}" style="background:#2B1B2E;color:#FAF6EF;padding:14px 28px;border-radius:999px;text-decoration:none">
          Open my portal
        </a>
      </p>
      <p style="color:#6b6168;font-size:13px">This link expires in 30 minutes and can be used once.
      If you didn't request it, you can safely ignore this email.</p>
    </div>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject: 'Your Gather Ghana sign-in link', html }),
  })
  return { sent: res.ok }
}
