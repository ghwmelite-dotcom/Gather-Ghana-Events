import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import Field from '../components/ui/Field.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { ArrowLeft, Spinner, Lock, Plus } from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'

export default function OrgTeam() {
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')
  const [invite, setInvite] = useState({ email: '', name: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try { setData(await api.orgOrganizers()); setState('ok') }
    catch (e) { setState(e instanceof ApiError && (e.status === 403 || e.status === 401) ? 'forbidden' : 'error') }
  }, [])
  useEffect(() => { load() }, [load])

  const run = async (fn) => { setBusy(true); setErr(''); setMsg('') ; try { await fn() } catch (e) { setErr(e instanceof ApiError ? e.message : 'Action failed.') } finally { setBusy(false); await load() } }
  const sendInvite = () => run(async () => {
    const res = await api.orgOrganizerAction({ action: 'invite', email: invite.email, name: invite.name })
    setMsg(res.emailed ? "Invite sent — they'll get a sign-in link." : 'Added, but the invite email could not be sent.')
    setInvite({ email: '', name: '' })
  })
  const revoke = (m) => { if (confirm(`Revoke organizer access for ${m.email}?`)) run(() => api.orgOrganizerAction({ action: 'revoke', clientId: m.clientId })) }

  if (state === 'loading') return <div className="min-h-dvh grid place-items-center text-plum"><Spinner size={32} /></div>
  if (state === 'forbidden') return (
    <Section tone="cream" className="min-h-dvh grid place-items-center"><Container className="text-center max-w-md">
      <Lock size={36} className="text-terracotta mx-auto" />
      <h1 className="font-display text-plum text-3xl mt-4">Organizer access only</h1>
      <Button to="/login" variant="primary" size="md" className="mt-6">Sign in</Button>
    </Container></Section>
  )
  if (state === 'error' || !data) return <div className="min-h-dvh grid place-items-center text-terracotta">Couldn't load the team.</div>

  return (
    <>
      <Seo title="Team · Organizer" noindex />
      <section className="bg-plum-deep text-cream pt-32 pb-10">
        <Container>
          <Link to="/org" className="inline-flex items-center gap-2 text-cream/70 hover:text-cream text-sm mb-5"><ArrowLeft size={16} /> Dashboard</Link>
          <h1 className="font-display text-4xl sm:text-5xl">Team</h1>
          <p className="text-cream/70 mt-2">Who can access the organizer portal.</p>
        </Container>
      </section>

      <Section tone="cream" pad="md">
        <Container className="grid lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-3">
            {data.members.map((m) => (
              <div key={m.clientId} className="rounded-2xl bg-cream-deep border border-plum/8 p-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-plum">{m.name} {m.isSelf && <span className="text-ink/45 text-xs">(you)</span>}</p>
                  <p className="text-ink/50 text-xs">{m.email}</p>
                </div>
                {m.source === 'config' ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-plum/10 text-ink/55">Permanent (config)</span>
                ) : m.isSelf ? null : (
                  <button disabled={busy} onClick={() => revoke(m)} className="text-xs rounded-full border border-terracotta/30 px-3 py-1.5 text-terracotta disabled:opacity-50">Revoke</button>
                )}
              </div>
            ))}
            {data.configEmails.filter((e) => !data.members.some((m) => m.email === e)).map((e) => (
              <div key={e} className="rounded-2xl bg-cream-deep border border-plum/8 p-5 flex items-center justify-between gap-3">
                <p className="text-ink/70 text-sm">{e} <span className="text-ink/40 text-xs">(not yet signed in)</span></p>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-plum/10 text-ink/55">Permanent (config)</span>
              </div>
            ))}
          </div>

          <div className="rounded-3xl bg-cream-deep border border-plum/8 p-7 space-y-4 lg:sticky lg:top-28">
            <h2 className="font-display text-plum text-xl">Invite an organizer</h2>
            <Field label="Email" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="name@example.com" />
            <Field label="Name (optional)" value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
            <Button onClick={sendInvite} disabled={!invite.email || busy} variant="primary" size="sm"><Plus size={16} /> Send invite</Button>
            {msg && <p className="text-kente text-sm">{msg}</p>}
            {err && <p role="alert" className="text-terracotta text-sm">{err}</p>}
          </div>
        </Container>
      </Section>
    </>
  )
}
