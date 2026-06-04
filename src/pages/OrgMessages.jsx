import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { ArrowLeft, Spinner, Lock, Mail, CheckCircle } from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const statusChip = {
  new: 'bg-champagne/25 text-terracotta',
  read: 'bg-plum/10 text-ink/55',
  replied: 'bg-kente/15 text-kente',
  _default: 'bg-ink/10 text-ink/50',
}

export default function OrgMessages() {
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')
  const [openId, setOpenId] = useState(null)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try { setData(await api.orgMessages()); setState('ok') }
    catch (e) { setState(e instanceof ApiError && (e.status === 403 || e.status === 401) ? 'forbidden' : 'error') }
  }, [])
  useEffect(() => { load() }, [load])

  const openMessage = async (m) => {
    setOpenId(m.id); setReply(''); setErr('')
    if (m.status === 'new') { try { await api.orgMessageAction({ action: 'mark', id: m.id, status: 'read' }); await load() } catch { /* noop */ } }
  }
  const sendReply = async (m) => {
    setBusy(true); setErr('')
    try {
      await api.orgMessageAction({ action: 'reply', id: m.id, body: reply })
      setOpenId(null); setReply(''); await load()
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not send the reply.') }
    finally { setBusy(false) }
  }

  if (state === 'loading') return <div className="min-h-dvh grid place-items-center text-plum"><Spinner size={32} /></div>
  if (state === 'forbidden') return (
    <Section tone="cream" className="min-h-dvh grid place-items-center"><Container className="text-center max-w-md">
      <Lock size={36} className="text-terracotta mx-auto" />
      <h1 className="font-display text-plum text-3xl mt-4">Organizer access only</h1>
      <Button to="/login" variant="primary" size="md" className="mt-6">Sign in</Button>
    </Container></Section>
  )
  if (state === 'error' || !data) return <div className="min-h-dvh grid place-items-center text-terracotta">Couldn't load messages.</div>
  const messages = data.messages || []

  return (
    <>
      <Seo title="Inbox · Organizer" noindex />
      <section className="bg-plum-deep text-cream pt-32 pb-10">
        <Container>
          <Link to="/org" className="inline-flex items-center gap-2 text-cream/70 hover:text-cream text-sm mb-5"><ArrowLeft size={16} /> Dashboard</Link>
          <h1 className="font-display text-4xl sm:text-5xl">Inbox</h1>
          <p className="text-cream/70 mt-2">Contact-form messages. Replies are emailed to the sender.</p>
        </Container>
      </section>

      <Section tone="cream" pad="md">
        <Container className="max-w-3xl space-y-3">
          {messages.length === 0 ? <p className="text-ink/55 text-sm">No messages.</p> : messages.map((m) => (
            <div key={m.id} className="rounded-2xl bg-cream-deep border border-plum/8 p-5">
              <button aria-label={`${openId === m.id ? 'Collapse' : 'Expand'} message from ${m.name}`} onClick={() => (openId === m.id ? setOpenId(null) : openMessage(m))} className="w-full text-left flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-plum">{m.name} <span className="text-ink/45 text-sm font-sans">· {m.email}</span></p>
                  <p className="text-ink/55 text-xs">{fmtDate(m.created_at)}</p>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${statusChip[m.status] ?? statusChip._default}`}>{m.status}</span>
              </button>
              {openId === m.id && (
                <div className="mt-4 pt-4 border-t border-plum/10">
                  <p className="text-ink/75 text-sm whitespace-pre-line leading-relaxed">{m.body}</p>
                  <div className="mt-4">
                    <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} aria-label={`Reply to ${m.name}`} placeholder={`Reply to ${m.name}…`}
                      className="w-full rounded-xl border border-plum/15 bg-cream px-4 py-3 text-ink text-sm" />
                    {err && <p role="alert" className="text-terracotta text-sm mt-2">{err}</p>}
                    <div className="mt-3 flex items-center gap-3">
                      <Button onClick={() => sendReply(m)} disabled={!reply.trim() || busy} variant="primary" size="sm"><Mail size={16} /> {busy ? 'Sending…' : 'Send reply'}</Button>
                      {m.status === 'replied' && <span className="text-kente text-xs inline-flex items-center gap-1"><CheckCircle size={13} /> Replied {fmtDate(m.replied_at)}</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </Container>
      </Section>
    </>
  )
}
