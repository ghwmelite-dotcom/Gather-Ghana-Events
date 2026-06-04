import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import Field from '../components/ui/Field.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import {
  ArrowLeft, ArrowRight, Spinner, Lock, CheckCircle, Plus, WhatsApp, Mail, Calendar, Users,
} from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'
import { formatMoney } from '../lib/money.js'

const ghs = (whole) => 'GH₵ ' + Number(whole || 0).toLocaleString()
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const LEAD_STATUSES = ['new', 'quoted', 'booked', 'completed', 'cancelled']
const escrowChip = {
  funded: 'bg-champagne/20 text-terracotta', release_requested: 'bg-champagne/30 text-terracotta',
  released: 'bg-kente/15 text-kente', disputed: 'bg-plum/10 text-ink/50', none: 'bg-plum/5 text-ink/40',
}

export default function OrgClient() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')
  const [busy, setBusy] = useState(null)
  const [add, setAdd] = useState({ title: '', due_date: '', amount: '' })
  const [prop, setProp] = useState({ title: '', amount: '' })

  const load = useCallback(async () => {
    try { setData(await api.orgClient(id)); setState('ok') }
    catch (e) { setState(e instanceof ApiError && (e.status === 403 || e.status === 401) ? 'forbidden' : 'error') }
  }, [id])
  useEffect(() => { load() }, [load])

  const run = async (fn) => { setBusy(true); try { await fn() } finally { setBusy(false); await load() } }
  const milestone = (payload) => run(() => api.orgMilestone(payload))
  const setStatus = (status) => run(() => api.orgInquiryStatus(id, status))

  if (state === 'loading') return <div className="min-h-dvh grid place-items-center text-plum"><Spinner size={32} /></div>
  if (state === 'forbidden') return (
    <Section tone="cream" className="min-h-dvh grid place-items-center"><Container className="text-center max-w-md">
      <Lock size={36} className="text-terracotta mx-auto" />
      <h1 className="font-display text-plum text-3xl mt-4">Organizer access only</h1>
      <Button to="/login" variant="primary" size="md" className="mt-6">Sign in</Button>
    </Container></Section>
  )
  if (state === 'error' || !data) return <div className="min-h-dvh grid place-items-center text-terracotta">Couldn’t load this client.</div>

  const { inquiry, milestones, payments, proposals, events, escrow, contributionsRaised } = data

  return (
    <>
      <Seo title={`Manage · ${inquiry.name}`} noindex />
      <section className="bg-plum-deep text-cream pt-32 pb-10">
        <Container>
          <Link to="/org" className="inline-flex items-center gap-2 text-cream/70 hover:text-cream text-sm mb-5"><ArrowLeft size={16} /> Dashboard</Link>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="font-display text-4xl sm:text-5xl">{inquiry.name}</h1>
              <p className="text-cream/70 mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                <a href={`mailto:${inquiry.email}`} className="inline-flex items-center gap-1.5 link-underline"><Mail size={14} /> {inquiry.email}</a>
                {inquiry.phone && <a href={`https://wa.me/${inquiry.phone.replace(/[^0-9]/g, '')}`} className="inline-flex items-center gap-1.5 link-underline"><WhatsApp size={14} /> {inquiry.phone}</a>}
              </p>
            </div>
            <label className="text-sm text-cream/70">Status&nbsp;
              <select value={inquiry.status} onChange={(e) => setStatus(e.target.value)} disabled={busy}
                className="bg-cream text-ink rounded-full px-4 py-1.5 text-sm">
                {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
        </Container>
      </section>

      <Section tone="cream" pad="md">
        <Container className="grid lg:grid-cols-3 gap-8 items-start">
          {/* Left: event + milestones */}
          <div className="lg:col-span-2 space-y-8">
            <div className="rounded-3xl bg-cream-deep border border-plum/8 p-7 grid sm:grid-cols-2 gap-5">
              <div className="flex items-center gap-3"><Calendar size={20} className="text-terracotta" /><div><p className="text-xs uppercase tracking-wider text-ink/45">Event</p><p className="font-display text-plum text-lg">{inquiry.event_type} · {fmtDate(inquiry.event_date)}</p></div></div>
              <div className="flex items-center gap-3"><Users size={20} className="text-terracotta" /><div><p className="text-xs uppercase tracking-wider text-ink/45">Guests / Estimate</p><p className="font-display text-plum text-lg tnum">{inquiry.guests || '—'} · {ghs(inquiry.estimate)}</p></div></div>
              {inquiry.notes && <p className="sm:col-span-2 text-ink/65 text-sm border-t border-plum/10 pt-4"><span className="text-ink/45">Brief: </span>{inquiry.notes}</p>}
              {events.length > 0 && <div className="sm:col-span-2 flex flex-wrap gap-2">{events.map((e) => <Link key={e.slug} to={`/e/${e.slug}`} className="text-sm text-terracotta inline-flex items-center gap-1 link-underline">/e/{e.slug} <ArrowRight size={14} /></Link>)}</div>}
            </div>

            {/* Milestones management */}
            <div className="rounded-3xl bg-cream-deep border border-plum/8 p-7">
              <h2 className="font-display text-plum text-2xl mb-1">Milestones & escrow</h2>
              <p className="text-ink/50 text-sm mb-5">You fund &amp; request release; the client approves each release.</p>
              <ul className="space-y-3">
                {milestones.map((m) => (
                  <li key={m.id} className="rounded-2xl border border-plum/8 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-display text-plum">{m.title}</p>
                        <p className="text-ink/45 text-xs">{fmtDate(m.due_date)} · {m.status}</p>
                      </div>
                      {m.amount > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="font-display text-plum tnum">{formatMoney(m.amount, m.currency)}</span>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full ${escrowChip[m.escrow_status]}`}>{m.escrow_status.replace('_', ' ')}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {m.amount > 0 && m.escrow_status === 'none' && <button disabled={busy} onClick={() => milestone({ action: 'fund', id: m.id })} className="text-xs rounded-full bg-plum text-cream px-3 py-1.5 disabled:opacity-50">Mark funded</button>}
                      {m.escrow_status === 'funded' && <button disabled={busy} onClick={() => milestone({ action: 'request_release', id: m.id })} className="text-xs rounded-full bg-terracotta text-cream px-3 py-1.5 disabled:opacity-50">Request release</button>}
                      {m.escrow_status === 'release_requested' && <span className="text-xs text-terracotta py-1.5">Awaiting client approval</span>}
                      {m.escrow_status === 'released' && <span className="text-xs text-kente py-1.5 inline-flex items-center gap-1"><CheckCircle size={13} /> Released</span>}
                      {m.status !== 'done' && <button disabled={busy} onClick={() => milestone({ action: 'upsert', id: m.id, inquiryId: id, title: m.title, description: m.description, due_date: m.due_date, status: 'done', amount: m.amount / 100, sort: m.sort })} className="text-xs rounded-full border border-plum/20 px-3 py-1.5 text-plum disabled:opacity-50">Mark done</button>}
                      <button disabled={busy} onClick={() => milestone({ action: 'delete', id: m.id })} className="text-xs rounded-full border border-terracotta/30 px-3 py-1.5 text-terracotta disabled:opacity-50 ml-auto">Delete</button>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Add milestone */}
              <div className="mt-5 pt-5 border-t border-plum/10 flex flex-wrap items-end gap-3">
                <Field className="flex-1 min-w-[160px]" label="New milestone" value={add.title} onChange={(e) => setAdd({ ...add, title: e.target.value })} placeholder="Vendor confirmations" />
                <Field label="Due" type="date" value={add.due_date} onChange={(e) => setAdd({ ...add, due_date: e.target.value })} />
                <Field label="Amount (GH₵)" type="number" value={add.amount} onChange={(e) => setAdd({ ...add, amount: e.target.value })} />
                <Button disabled={!add.title || busy} onClick={() => milestone({ action: 'upsert', inquiryId: id, title: add.title, due_date: add.due_date, amount: add.amount, status: 'upcoming' }).then(() => setAdd({ title: '', due_date: '', amount: '' }))} variant="primary" size="sm"><Plus size={16} /> Add</Button>
              </div>
            </div>
          </div>

          {/* Right: payments + proposals */}
          <div className="space-y-6">
            <div className="rounded-3xl bg-plum text-cream p-7">
              <h2 className="font-display text-xl mb-4">Money</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-cream/65">Estimate</dt><dd className="tnum">{ghs(inquiry.estimate)}</dd></div>
                <div className="flex justify-between"><dt className="text-cream/65">Held in escrow</dt><dd className="tnum text-champagne-light">{formatMoney(escrow.held, 'GHS')}</dd></div>
                <div className="flex justify-between"><dt className="text-cream/65">Released</dt><dd className="tnum">{formatMoney(escrow.released, 'GHS')}</dd></div>
                <div className="flex justify-between"><dt className="text-cream/65">Contributions</dt><dd className="tnum text-champagne-light">{formatMoney(contributionsRaised, 'GHS')}</dd></div>
              </dl>
              {payments.length > 0 && (
                <ul className="mt-4 pt-4 border-t border-cream/15 space-y-2 text-sm">
                  {payments.map((p) => <li key={p.reference} className="flex justify-between"><span className="text-cream/65 capitalize">{p.purpose}</span><span className="tnum">{formatMoney(p.amount, p.currency)} · {p.status}</span></li>)}
                </ul>
              )}
            </div>

            {/* Proposals */}
            <div className="rounded-3xl bg-cream-deep border border-plum/8 p-7">
              <h2 className="font-display text-plum text-xl mb-4">Proposals</h2>
              {proposals.length === 0 ? <p className="text-ink/55 text-sm">No proposals yet.</p> : (
                <ul className="space-y-2 mb-4">
                  {proposals.map((p) => (
                    <li key={p.id} className="flex justify-between items-center text-sm">
                      <span className="text-ink/75">{p.title}</span>
                      <span className="flex items-center gap-2"><span className="text-plum tnum">{formatMoney(p.amount, p.currency)}</span><span className="text-[11px] px-2 py-0.5 rounded-full bg-plum/10 text-ink/55">{p.status}</span></span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-end gap-2 pt-3 border-t border-plum/10">
                <Field className="flex-1 min-w-[140px]" label="New proposal" value={prop.title} onChange={(e) => setProp({ ...prop, title: e.target.value })} placeholder="Full planning & styling" />
                <Field label="GH₵" type="number" value={prop.amount} onChange={(e) => setProp({ ...prop, amount: e.target.value })} />
                <Button disabled={!prop.title || busy} onClick={() => run(() => api.createProposal({ inquiryId: id, title: prop.title, amount: prop.amount })).then(() => setProp({ title: '', amount: '' }))} variant="primary" size="sm">Send</Button>
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  )
}
