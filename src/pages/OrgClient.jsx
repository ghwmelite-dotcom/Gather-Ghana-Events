import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import Field from '../components/ui/Field.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import {
  ArrowLeft, ArrowRight, Spinner, Lock, CheckCircle, Plus, WhatsApp, Mail, Calendar, Users, Check, Clock,
} from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'
import { formatMoney } from '../lib/money.js'
import { useAuth } from '../lib/AuthContext.jsx'

const ghs = (whole) => 'GH₵ ' + Number(whole || 0).toLocaleString()
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const LEAD_STATUSES = ['new', 'quoted', 'booked', 'completed', 'cancelled']
const escrowChip = {
  funded: 'bg-champagne/20 text-terracotta', release_requested: 'bg-champagne/30 text-terracotta',
  released: 'bg-kente/15 text-kente', disputed: 'bg-plum/10 text-ink/50', none: 'bg-plum/5 text-ink/40',
}
const TASK_NEXT = { open: 'in_progress', in_progress: 'done', done: 'open' }
const EXPENSE_NEXT = { planned: 'committed', committed: 'paid' }
const EXPENSE_CATEGORIES = ['venue', 'catering', 'decor', 'photography', 'music', 'rentals', 'transport', 'staffing', 'fees', 'misc']
const expenseChip = {
  planned: 'bg-plum/5 text-ink/50', committed: 'bg-champagne/25 text-terracotta', paid: 'bg-kente/15 text-kente',
}

export default function OrgClient() {
  const { client } = useAuth()
  const canWrite = client?.canWrite !== false
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')
  const [busy, setBusy] = useState(null)
  const [add, setAdd] = useState({ title: '', due_date: '', amount: '' })
  const [prop, setProp] = useState({ title: '', amount: '' })
  const [task, setTask] = useState({ title: '', due_date: '', assignee_email: '' })
  const [cost, setCost] = useState({ amount: '', category: 'misc', vendor_name: '' })
  const [team, setTeam] = useState([])
  const [thread, setThread] = useState([])
  const [msg, setMsg] = useState('')

  const loadThread = useCallback(async () => {
    try { setThread((await api.orgThread(id)).messages || []) } catch { /* noop */ }
  }, [id])
  useEffect(() => { loadThread() }, [loadThread])

  const load = useCallback(async () => {
    try { setData(await api.orgClient(id)); setState('ok') }
    catch (e) { setState(e instanceof ApiError && (e.status === 403 || e.status === 401) ? 'forbidden' : 'error') }
  }, [id])
  useEffect(() => { load() }, [load])
  useEffect(() => { api.orgOrganizers().then((r) => setTeam(r.members || [])).catch(() => {}) }, [])

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

  const { inquiry, milestones, payments, proposals, events, escrow, contributionsRaised, tasks = [], expenses = [], activity = [] } = data
  const estimateMinor = Math.round((inquiry.estimate || 0) * 100)
  const collected = payments.filter((p) => p.status === 'success').reduce((a, p) => a + p.amount, 0)
  const costsPaid = expenses.filter((e) => e.status === 'paid').reduce((a, e) => a + e.amount, 0)
  const costsTotal = expenses.reduce((a, e) => a + e.amount, 0)

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
              <select value={inquiry.status} onChange={(e) => setStatus(e.target.value)} disabled={busy || !canWrite}
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
                      {m.amount > 0 && m.escrow_status === 'none' && <button disabled={busy || !canWrite} onClick={() => milestone({ action: 'fund', id: m.id })} className="text-xs rounded-full bg-plum text-cream px-3 py-1.5 disabled:opacity-50">Mark funded</button>}
                      {m.escrow_status === 'funded' && <button disabled={busy || !canWrite} onClick={() => milestone({ action: 'request_release', id: m.id })} className="text-xs rounded-full bg-terracotta text-cream px-3 py-1.5 disabled:opacity-50">Request release</button>}
                      {m.escrow_status === 'release_requested' && <span className="text-xs text-terracotta py-1.5">Awaiting client approval</span>}
                      {m.escrow_status === 'released' && <span className="text-xs text-kente py-1.5 inline-flex items-center gap-1"><CheckCircle size={13} /> Released</span>}
                      {m.status !== 'done' && <button disabled={busy || !canWrite} onClick={() => milestone({ action: 'upsert', id: m.id, inquiryId: id, title: m.title, description: m.description, due_date: m.due_date, status: 'done', amount: m.amount / 100, sort: m.sort })} className="text-xs rounded-full border border-plum/20 px-3 py-1.5 text-plum disabled:opacity-50">Mark done</button>}
                      <button disabled={busy || !canWrite} onClick={() => milestone({ action: 'delete', id: m.id })} className="text-xs rounded-full border border-terracotta/30 px-3 py-1.5 text-terracotta disabled:opacity-50 ml-auto">Delete</button>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Add milestone */}
              <div className="mt-5 pt-5 border-t border-plum/10 flex flex-wrap items-end gap-3">
                <Field className="flex-1 min-w-[160px]" label="New milestone" value={add.title} onChange={(e) => setAdd({ ...add, title: e.target.value })} placeholder="Vendor confirmations" />
                <Field label="Due" type="date" value={add.due_date} onChange={(e) => setAdd({ ...add, due_date: e.target.value })} />
                <Field label="Amount (GH₵)" type="number" value={add.amount} onChange={(e) => setAdd({ ...add, amount: e.target.value })} />
                <Button disabled={!add.title || busy || !canWrite} onClick={() => milestone({ action: 'upsert', inquiryId: id, title: add.title, due_date: add.due_date, amount: add.amount, status: 'upcoming' }).then(() => setAdd({ title: '', due_date: '', amount: '' }))} variant="primary" size="sm"><Plus size={16} /> Add</Button>
              </div>
            </div>

            {/* Team tasks for this event */}
            <div className="rounded-3xl bg-cream-deep border border-plum/8 p-7">
              <div className="flex items-baseline justify-between gap-3 mb-5">
                <h2 className="font-display text-plum text-2xl">Tasks</h2>
                <Link to="/org/tasks" className="text-sm text-terracotta inline-flex items-center gap-1 link-underline">All tasks <ArrowRight size={14} /></Link>
              </div>
              {tasks.length === 0 ? <p className="text-ink/55 text-sm">No tasks for this event yet.</p> : (
                <ul className="space-y-2">
                  {tasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-plum/8 p-3">
                      <button aria-label={`Set "${t.title}" to ${TASK_NEXT[t.status].replace('_', ' ')}`} disabled={busy || !canWrite}
                        onClick={() => run(() => api.orgTaskAction({ action: 'set_status', id: t.id, status: TASK_NEXT[t.status] }))}
                        className={`shrink-0 size-7 rounded-full border grid place-items-center disabled:opacity-50 ${t.status === 'done' ? 'bg-kente text-cream border-kente' : t.status === 'in_progress' ? 'border-terracotta text-terracotta' : 'border-plum/25 text-plum/30 hover:border-plum/50'}`}>
                        {t.status === 'in_progress' ? <Clock size={13} /> : <Check size={13} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${t.status === 'done' ? 'text-ink/40 line-through' : 'text-plum'}`}>{t.title}</p>
                        <p className="text-xs text-ink/45">{t.assignee_email || 'Unassigned'}{t.due_date ? ` · due ${fmtDate(t.due_date)}` : ''}</p>
                      </div>
                      <button aria-label={`Delete ${t.title}`} disabled={busy || !canWrite}
                        onClick={() => { if (confirm(`Delete "${t.title}"?`)) run(() => api.orgTaskAction({ action: 'delete', id: t.id })) }}
                        className="text-xs rounded-full border border-terracotta/30 px-3 py-1 text-terracotta disabled:opacity-50">Delete</button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-5 pt-5 border-t border-plum/10 flex flex-wrap items-end gap-3">
                <Field className="flex-1 min-w-[160px]" label="New task" value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} placeholder="Confirm caterer headcount" />
                <Field label="Due" type="date" value={task.due_date} onChange={(e) => setTask({ ...task, due_date: e.target.value })} />
                <label className="block">
                  <span className="block text-sm text-ink/70 mb-1.5">Assign to</span>
                  <select value={task.assignee_email} onChange={(e) => setTask({ ...task, assignee_email: e.target.value })} className="rounded-xl border border-plum/15 bg-cream px-4 py-2.5 text-ink">
                    <option value="">Unassigned</option>
                    {team.map((m) => <option key={m.email} value={m.email}>{m.name || m.email}</option>)}
                  </select>
                </label>
                <Button disabled={!task.title || busy || !canWrite} onClick={() => run(() => api.orgTaskAction({ action: 'create', inquiryId: id, ...task })).then(() => setTask({ title: '', due_date: '', assignee_email: '' }))} variant="primary" size="sm"><Plus size={16} /> Add</Button>
              </div>
            </div>

            {/* Budget & costs for this event */}
            <div className="rounded-3xl bg-cream-deep border border-plum/8 p-7">
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <h2 className="font-display text-plum text-2xl">Budget & costs</h2>
                <Link to="/org/books" className="text-sm text-terracotta inline-flex items-center gap-1 link-underline">Books <ArrowRight size={14} /></Link>
              </div>
              <p className="text-ink/50 text-sm mb-5">Planned and committed lines are the budget; paid is money out the door.</p>
              {expenses.length === 0 ? <p className="text-ink/55 text-sm">No cost lines yet — record what this event will cost you.</p> : (
                <ul className="space-y-2">
                  {expenses.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-plum/8 p-3">
                      <div className="flex-1 min-w-[150px]">
                        <p className="text-sm font-medium text-plum">{e.vendor_name || e.description || e.category}</p>
                        <p className="text-xs text-ink/45 capitalize">{e.category}</p>
                      </div>
                      <span className="font-display text-plum tnum text-sm">{formatMoney(e.amount, e.currency)}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${expenseChip[e.status]}`}>{e.status}</span>
                      {EXPENSE_NEXT[e.status] && (
                        <button disabled={busy || !canWrite} onClick={() => run(() => api.orgExpenseAction({ action: 'set_status', id: e.id, status: EXPENSE_NEXT[e.status] }))}
                          className="text-xs rounded-full bg-plum text-cream px-3 py-1 disabled:opacity-50">Mark {EXPENSE_NEXT[e.status]}</button>
                      )}
                      <button aria-label="Delete expense" disabled={busy || !canWrite}
                        onClick={() => { if (confirm('Delete this expense?')) run(() => api.orgExpenseAction({ action: 'delete', id: e.id })) }}
                        className="text-xs rounded-full border border-terracotta/30 px-3 py-1 text-terracotta disabled:opacity-50">Delete</button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-5 pt-5 border-t border-plum/10 flex flex-wrap items-end gap-3">
                <Field label="Amount (GH₵)" type="number" value={cost.amount} onChange={(e) => setCost({ ...cost, amount: e.target.value })} />
                <label className="block">
                  <span className="block text-sm text-ink/70 mb-1.5">Category</span>
                  <select value={cost.category} onChange={(e) => setCost({ ...cost, category: e.target.value })} className="rounded-xl border border-plum/15 bg-cream px-4 py-2.5 text-ink capitalize">
                    {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <Field className="flex-1 min-w-[140px]" label="Vendor / payee" value={cost.vendor_name} onChange={(e) => setCost({ ...cost, vendor_name: e.target.value })} placeholder="Bloom & Co." />
                <Button disabled={!cost.amount || busy || !canWrite} onClick={() => run(() => api.orgExpenseAction({ action: 'create', inquiryId: id, ...cost })).then(() => setCost({ amount: '', category: 'misc', vendor_name: '' }))} variant="primary" size="sm"><Plus size={16} /> Add</Button>
              </div>
            </div>
          </div>

          {/* Right: payments + proposals */}
          <div className="space-y-6">
            <div className="rounded-3xl bg-plum text-cream p-7">
              <h2 className="font-display text-xl mb-4">Money</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-cream/65">Estimate</dt><dd className="tnum">{ghs(inquiry.estimate)}</dd></div>
                <div className="flex justify-between"><dt className="text-cream/65">Collected</dt><dd className="tnum">{formatMoney(collected, 'GHS')}</dd></div>
                <div className="flex justify-between"><dt className="text-cream/65">Held in escrow</dt><dd className="tnum text-champagne-light">{formatMoney(escrow.held, 'GHS')}</dd></div>
                <div className="flex justify-between"><dt className="text-cream/65">Released</dt><dd className="tnum">{formatMoney(escrow.released, 'GHS')}</dd></div>
                <div className="flex justify-between"><dt className="text-cream/65">Contributions</dt><dd className="tnum text-champagne-light">{formatMoney(contributionsRaised, 'GHS')}</dd></div>
                <div className="flex justify-between border-t border-cream/15 pt-2"><dt className="text-cream/65">Costs (paid / all)</dt><dd className="tnum">{formatMoney(costsPaid, 'GHS')} / {formatMoney(costsTotal, 'GHS')}</dd></div>
                <div className="flex justify-between"><dt className="text-cream/65">Projected margin</dt><dd className={`tnum ${estimateMinor - costsTotal < 0 ? 'text-terracotta' : 'text-champagne-light'}`}>{formatMoney(estimateMinor - costsTotal, 'GHS')}</dd></div>
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
                <Button disabled={!prop.title || busy || !canWrite} onClick={() => run(() => api.createProposal({ inquiryId: id, title: prop.title, amount: prop.amount })).then(() => setProp({ title: '', amount: '' }))} variant="primary" size="sm">Send</Button>
              </div>
            </div>

            {/* Messages with the client */}
            <div className="rounded-3xl bg-cream-deep border border-plum/8 p-7">
              <h2 className="font-display text-plum text-xl mb-1">Messages</h2>
              <p className="text-ink/50 text-sm mb-4">{inquiry.name.split(' ')[0]} sees these in their portal and gets an email.</p>
              {thread.length === 0 ? <p className="text-ink/55 text-sm">No messages yet — start the conversation.</p> : (
                <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {thread.map((t) => (
                    <li key={t.id} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${t.sender_role === 'organizer' ? 'ml-auto bg-plum text-cream rounded-br-md' : 'bg-cream border border-plum/10 text-ink/80 rounded-bl-md'}`}>
                      <p className="whitespace-pre-line leading-relaxed">{t.body}</p>
                      <p className={`text-[10px] mt-1 ${t.sender_role === 'organizer' ? 'text-cream/55' : 'text-ink/40'}`}>
                        {new Date(t.created_at).toLocaleString('en-GH', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 pt-4 border-t border-plum/10 flex items-end gap-2">
                <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={2} aria-label={`Message ${inquiry.name}`} placeholder="Write a message…"
                  className="flex-1 rounded-xl border border-plum/15 bg-cream px-4 py-2.5 text-ink text-sm resize-none" />
                <Button disabled={!msg.trim() || busy || !canWrite} variant="primary" size="sm"
                  onClick={async () => { setBusy(true); try { await api.orgThreadSend({ inquiryId: id, body: msg }); setMsg(''); await loadThread() } finally { setBusy(false) } }}>
                  Send
                </Button>
              </div>
            </div>

            {/* Activity trail for this event */}
            <div className="rounded-3xl bg-cream-deep border border-plum/8 p-7">
              <h2 className="font-display text-plum text-xl mb-4">Activity</h2>
              {activity.length === 0 ? <p className="text-ink/55 text-sm">Nothing logged yet — changes to this event will show here.</p> : (
                <ul className="space-y-3">
                  {activity.map((a) => (
                    <li key={a.id} className="text-sm border-t border-plum/8 pt-3 first:border-0 first:pt-0">
                      <p className="text-ink/75">{a.detail || a.action}</p>
                      <p className="text-ink/45 text-xs">{a.actor_email} · {new Date(a.created_at).toLocaleString('en-GH', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Container>
      </Section>
    </>
  )
}
