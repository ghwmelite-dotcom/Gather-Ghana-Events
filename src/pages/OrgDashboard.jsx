import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import Field from '../components/ui/Field.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { Users, Calendar, Heart, Lock, Spinner, ArrowRight, Plus } from '../lib/icons.jsx'
import * as Icons from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'
import { formatMoney } from '../lib/money.js'
import { sectionsForRole } from '../lib/guide.js'
import { useAuth } from '../lib/AuthContext.jsx'

// Resolve a guide section's icon name to its component, with a safe fallback.
function GuideIcon({ name, ...props }) {
  const C = Icons[name] || Icons.Sparkles
  return <C {...props} />
}

const ghs = (whole) => 'GH₵ ' + Number(whole || 0).toLocaleString()
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

function Stat({ Icon, label, value }) {
  return (
    <div className="rounded-2xl bg-cream-deep border border-plum/8 p-6">
      <Icon size={22} className="text-terracotta" />
      <p className="font-display text-plum text-3xl mt-3 tnum">{value}</p>
      <p className="text-ink/55 text-sm">{label}</p>
    </div>
  )
}

function LeadRow({ lead, onProposal, canWrite }) {
  const [open, setOpen] = useState(false)
  const [p, setP] = useState({ title: '', amount: '' })
  const [sent, setSent] = useState(false)
  const send = async () => {
    await onProposal(lead.id, p)
    setSent(true); setOpen(false)
  }
  return (
    <>
      <tr className="border-t border-plum/8">
        <td className="py-3 pr-4">
          <Link to={`/org/clients/${lead.id}`} className="font-medium text-plum link-underline">{lead.name}</Link>
          {lead.unread > 0 && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-terracotta text-cream font-semibold align-middle" title={`${lead.unread} unread message${lead.unread > 1 ? 's' : ''}`}>{lead.unread}</span>}
          <p className="text-ink/50 text-xs">{lead.email}</p>
        </td>
        <td className="py-3 pr-4 text-ink/70">{lead.event_type}</td>
        <td className="py-3 pr-4 text-ink/70 whitespace-nowrap">{fmtDate(lead.event_date)}</td>
        <td className="py-3 pr-4 text-plum tnum">{ghs(lead.estimate)}</td>
        <td className="py-3 pr-4"><span className="text-xs px-2 py-0.5 rounded-full bg-plum/10 text-ink/60">{lead.status}</span></td>
        <td className="py-3 text-right">
          {sent ? <span className="text-kente text-xs">Sent ✓</span> : (
            <button onClick={() => setOpen(!open)} className="text-sm text-terracotta inline-flex items-center gap-1 link-underline"><Plus size={14} /> Proposal</button>
          )}
        </td>
      </tr>
      {open && (
        <tr className="bg-cream-deep/60"><td colSpan={6} className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field className="flex-1 min-w-[180px]" label="Proposal title" value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} placeholder="Full planning & styling" />
            <Field label="Amount (GH₵)" type="number" value={p.amount} onChange={(e) => setP({ ...p, amount: e.target.value })} />
            <Button onClick={send} variant="primary" size="sm" disabled={!p.title || !canWrite}>Send</Button>
          </div>
        </td></tr>
      )}
    </>
  )
}

export default function OrgDashboard() {
  const { client } = useAuth()
  const canWrite = client?.canWrite !== false
  const guideRole = canWrite ? 'admin' : 'viewer'
  const guideLinks = sectionsForRole(guideRole).slice(0, 6)
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading') // loading | ok | forbidden | error

  const load = useCallback(async () => {
    try {
      const res = await api.orgOverview()
      setData(res); setState('ok')
    } catch (e) {
      setState(e instanceof ApiError && e.status === 403 ? 'forbidden' : e.status === 401 ? 'forbidden' : 'error')
    }
  }, [])
  useEffect(() => { load() }, [load])

  const onProposal = async (inquiryId, p) => {
    try { await api.createProposal({ inquiryId, title: p.title, amount: p.amount }) } catch { /* noop */ }
  }

  if (state === 'loading') return <div className="min-h-dvh grid place-items-center text-plum"><Spinner size={32} /></div>
  if (state === 'forbidden') return (
    <Section tone="cream" className="min-h-dvh grid place-items-center">
      <Container className="text-center max-w-md">
        <Lock size={36} className="text-terracotta mx-auto" />
        <h1 className="font-display text-plum text-3xl mt-4">Organizer access only</h1>
        <p className="text-ink/60 mt-2">{client ? 'Your account isn’t set up as an organizer.' : 'Please sign in as an organizer.'}</p>
        <Button to={client ? '/portal' : '/login'} variant="primary" size="md" className="mt-6">{client ? 'My portal' : 'Sign in'}</Button>
      </Container>
    </Section>
  )
  if (state === 'error' || !data) return <div className="min-h-dvh grid place-items-center text-terracotta">Couldn’t load the dashboard.</div>

  const { stats } = data

  return (
    <>
      <Seo title="Organizer Dashboard" noindex />
      <section className="bg-plum-deep text-cream pt-32 pb-12">
        <Container>
          <p className="text-champagne-light text-sm tracking-[0.3em] uppercase mb-3">Organizer OS</p>
          <h1 className="font-display text-4xl sm:text-5xl">Welcome, {data.organizer.name?.split(' ')[0] || 'planner'}.</h1>
          <nav aria-label="Organizer tools" className="mt-5 flex flex-wrap gap-2">
            <Link to="/org/tasks" className="text-sm rounded-full bg-cream/10 hover:bg-cream/20 text-cream px-4 py-1.5 transition-colors">Tasks{data.stats.openTasks ? ` (${data.stats.openTasks})` : ''}</Link>
            <Link to="/org/events" className="text-sm rounded-full bg-cream/10 hover:bg-cream/20 text-cream px-4 py-1.5 transition-colors">Events</Link>
            <Link to="/org/services" className="text-sm rounded-full bg-cream/10 hover:bg-cream/20 text-cream px-4 py-1.5 transition-colors">Services</Link>
            <Link to="/org/content" className="text-sm rounded-full bg-cream/10 hover:bg-cream/20 text-cream px-4 py-1.5 transition-colors">Content</Link>
            <Link to="/org/books" className="text-sm rounded-full bg-cream/10 hover:bg-cream/20 text-cream px-4 py-1.5 transition-colors">Financials</Link>
            <Link to="/org/vendors" className="text-sm rounded-full bg-cream/10 hover:bg-cream/20 text-cream px-4 py-1.5 transition-colors">Vendors</Link>
            <Link to="/org/messages" className="text-sm rounded-full bg-cream/10 hover:bg-cream/20 text-cream px-4 py-1.5 transition-colors">Inbox</Link>
            <Link to="/org/team" className="text-sm rounded-full bg-cream/10 hover:bg-cream/20 text-cream px-4 py-1.5 transition-colors">Team</Link>
            <Link to={`/guide?role=${guideRole}`} className="text-sm rounded-full bg-cream/10 hover:bg-cream/20 text-cream px-4 py-1.5 transition-colors">Guide</Link>
          </nav>
        </Container>
      </section>

      <Section tone="cream" pad="md">
        <Container>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <Stat Icon={Users} label="Leads" value={stats.leads} />
            <Stat Icon={Calendar} label="Event pages" value={stats.events} />
            <Stat Icon={Heart} label="Contributions" value={formatMoney(stats.contributionsRaised, 'GHS')} />
            <Stat Icon={Lock} label="Held in escrow" value={formatMoney(stats.escrowHeld, 'GHS')} />
          </div>

          <div className="grid lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-8">
              {/* Leads */}
              <div className="rounded-3xl bg-cream-deep border border-plum/8 p-6 sm:p-8 overflow-x-auto">
                <h2 className="font-display text-plum text-2xl mb-5">Leads</h2>
                {data.leads.length === 0 ? <p className="text-ink/55 text-sm">No inquiries yet.</p> : (
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-ink/45 text-xs uppercase tracking-wider">
                      <th className="pb-2 pr-4 font-medium">Client</th><th className="pb-2 pr-4 font-medium">Type</th><th className="pb-2 pr-4 font-medium">Date</th><th className="pb-2 pr-4 font-medium">Est.</th><th className="pb-2 pr-4 font-medium">Status</th><th></th>
                    </tr></thead>
                    <tbody>{data.leads.map((l) => <LeadRow key={l.id} lead={l} onProposal={onProposal} canWrite={canWrite} />)}</tbody>
                  </table>
                )}
              </div>

              {/* Events */}
              <div className="rounded-3xl bg-cream-deep border border-plum/8 p-6 sm:p-8">
                <h2 className="font-display text-plum text-2xl mb-5">Event pages</h2>
                {data.events.length === 0 ? <p className="text-ink/55 text-sm">No event pages yet — create one.</p> : (
                  <ul className="divide-y divide-plum/8">
                    {data.events.map((e) => (
                      <li key={e.slug} className="py-3 flex items-center justify-between gap-4">
                        <div><p className="font-display text-plum">{e.host_names || e.title}</p><p className="text-ink/50 text-xs">{fmtDate(e.event_date)} · {e.visibility}</p></div>
                        <Link to={`/e/${e.slug}`} className="text-terracotta text-sm inline-flex items-center gap-1 link-underline">View <ArrowRight size={14} /></Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="space-y-8">
              {/* Role-aware guide — surfaces the handbook topics that matter to this role. */}
              <div className="rounded-3xl bg-cream-deep border border-plum/8 p-7">
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center w-9 h-9 rounded-full bg-plum/5 text-terracotta shrink-0"><Icons.Sparkles size={18} /></span>
                  <h2 className="font-display text-plum text-xl">{canWrite ? 'Your guide' : 'View-only guide'}</h2>
                </div>
                <p className="text-ink/55 text-sm mt-2 mb-4">
                  {canWrite
                    ? 'The handbook topics that matter most when you’re running the show.'
                    : 'You have view-only access — here’s how to read everything you can see.'}
                </p>
                <ul className="space-y-0.5">
                  {guideLinks.map((s) => (
                    <li key={s.id}>
                      <Link to={`/guide?role=${guideRole}#${s.id}`} className="flex items-center gap-2.5 py-1 text-sm text-ink/75 hover:text-plum transition-colors">
                        <span className="grid place-items-center w-7 h-7 rounded-full bg-plum/5 text-terracotta shrink-0"><GuideIcon name={s.icon} size={14} /></span>
                        <span className="link-underline">{s.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link to={`/guide?role=${guideRole}`} className="mt-4 inline-flex items-center gap-1.5 text-sm text-terracotta link-underline">
                  {canWrite ? 'Open the full guide' : 'Open your full guide'} <ArrowRight size={14} />
                </Link>
              </div>

              <Link to="/org/events" className="block rounded-3xl bg-plum text-cream p-7 hover:bg-plum-soft transition-colors">
                <p className="font-display text-xl">Event pages</p>
                <p className="text-cream/65 text-sm mt-1">Create and manage shareable event pages.</p>
                <span className="mt-4 inline-flex items-center gap-2 text-champagne-light text-sm">New event page <ArrowRight size={16} /></span>
              </Link>
              <div className="rounded-3xl bg-cream-deep border border-plum/8 p-7">
                <h2 className="font-display text-plum text-xl mb-4">Recent messages</h2>
                {data.messages.length === 0 ? <p className="text-ink/55 text-sm">No messages.</p> : (
                  <ul className="space-y-3">
                    {data.messages.slice(0, 6).map((m, i) => (
                      <li key={m.id || i} className="text-sm border-t border-plum/8 pt-3 first:border-0 first:pt-0">
                        <p className="text-plum font-medium">{m.name}</p>
                        <p className="text-ink/60 line-clamp-2">{m.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-3xl bg-cream-deep border border-plum/8 p-7">
                <h2 className="font-display text-plum text-xl mb-4">Recent activity</h2>
                {(data.activity || []).length === 0 ? <p className="text-ink/55 text-sm">Nothing logged yet — actions across the team will show here.</p> : (
                  <ul className="space-y-3">
                    {data.activity.map((a) => (
                      <li key={a.id} className="text-sm border-t border-plum/8 pt-3 first:border-0 first:pt-0">
                        <p className="text-ink/75">{a.detail || a.action}</p>
                        <p className="text-ink/45 text-xs">{a.actor_email} · {new Date(a.created_at).toLocaleString('en-GH', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  )
}
