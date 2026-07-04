import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import Field from '../components/ui/Field.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { ArrowLeft, ArrowRight, Spinner, Lock, Plus, Check, Clock } from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'
import { useAuth } from '../lib/AuthContext.jsx'

const BLANK = { title: '', due_date: '', assignee_email: '', inquiryId: '', notes: '' }
const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'done', label: 'Done' },
]
const NEXT_STATUS = { open: 'in_progress', in_progress: 'done', done: 'open' }
const statusChip = {
  open: 'bg-plum/5 text-ink/50',
  in_progress: 'bg-champagne/25 text-terracotta',
  done: 'bg-kente/15 text-kente',
}
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' }) : '')
const isOverdue = (t) => t.due_date && t.status !== 'done' && new Date(t.due_date) < new Date(new Date().toDateString())

export default function OrgTasks() {
  const { client } = useAuth()
  const canWrite = client?.canWrite !== false
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [filter, setFilter] = useState('all')
  const [who, setWho] = useState('all')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try { setData(await api.orgTasks()); setState('ok') }
    catch (e) { setState(e instanceof ApiError && (e.status === 403 || e.status === 401) ? 'forbidden' : 'error') }
  }, [])
  useEffect(() => { load() }, [load])

  const run = async (fn) => {
    setBusy(true); setErr('')
    try { await fn() }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Something went wrong.') }
    finally { setBusy(false); await load() }
  }
  const set = (k) => (e) => { const v = e.target.value; setForm((prev) => ({ ...prev, [k]: v })) }

  const add = () => run(async () => {
    await api.orgTaskAction({ action: 'create', ...form })
    setForm(BLANK)
  })

  const tasks = useMemo(() => {
    let list = data?.tasks || []
    if (filter !== 'all') list = list.filter((t) => t.status === filter)
    if (who === 'me') list = list.filter((t) => t.assignee_email === client?.email)
    else if (who !== 'all') list = list.filter((t) => t.assignee_email === who)
    return list
  }, [data, filter, who, client])

  if (state === 'loading') return <div className="min-h-dvh grid place-items-center text-plum"><Spinner size={32} /></div>
  if (state === 'forbidden') return (
    <Section tone="cream" className="min-h-dvh grid place-items-center"><Container className="text-center max-w-md">
      <Lock size={36} className="text-terracotta mx-auto" />
      <h1 className="font-display text-plum text-3xl mt-4">Organizer access only</h1>
      <Button to="/login" variant="primary" size="md" className="mt-6">Sign in</Button>
    </Container></Section>
  )
  if (state === 'error' || !data) return <div className="min-h-dvh grid place-items-center text-terracotta">Couldn't load tasks.</div>

  const team = data.team || []
  const openCount = (data.tasks || []).filter((t) => t.status !== 'done').length

  return (
    <>
      <Seo title="Tasks · Organizer" noindex />
      <section className="bg-plum-deep text-cream pt-32 pb-10">
        <Container>
          <Link to="/org" className="inline-flex items-center gap-2 text-cream/70 hover:text-cream text-sm mb-5"><ArrowLeft size={16} /> Dashboard</Link>
          <h1 className="font-display text-4xl sm:text-5xl">Team tasks</h1>
          <p className="text-cream/70 mt-2">{openCount} open — assign work, set due dates, and keep everyone moving.</p>
        </Container>
      </section>

      <Section tone="cream" pad="md">
        <Container className="grid lg:grid-cols-3 gap-8 items-start">
          {err && <p role="alert" className="lg:col-span-3 text-terracotta text-sm">{err}</p>}

          {/* List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_FILTERS.map((f) => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${filter === f.key ? 'bg-plum text-cream border-plum' : 'border-plum/20 text-plum hover:bg-plum/5'}`}>
                  {f.label}
                </button>
              ))}
              <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Filter by assignee"
                className="ml-auto text-xs rounded-full border border-plum/20 bg-cream px-3 py-1.5 text-plum">
                <option value="all">Everyone</option>
                <option value="me">Mine</option>
                {team.filter((m) => m.email !== client?.email).map((m) => <option key={m.email} value={m.email}>{m.name || m.email}</option>)}
              </select>
            </div>

            {tasks.length === 0 ? <p className="text-ink/55 text-sm">No tasks here — add one.</p> : tasks.map((t) => (
              <div key={t.id} className="rounded-2xl bg-cream-deep border border-plum/8 p-4 flex flex-wrap items-center gap-3">
                <button aria-label={`Set "${t.title}" to ${NEXT_STATUS[t.status].replace('_', ' ')}`} disabled={busy || !canWrite}
                  onClick={() => run(() => api.orgTaskAction({ action: 'set_status', id: t.id, status: NEXT_STATUS[t.status] }))}
                  className={`shrink-0 size-8 rounded-full border grid place-items-center transition-colors disabled:opacity-50 ${t.status === 'done' ? 'bg-kente text-cream border-kente' : t.status === 'in_progress' ? 'border-terracotta text-terracotta' : 'border-plum/25 text-plum/30 hover:border-plum/50'}`}>
                  {t.status === 'done' ? <Check size={15} /> : t.status === 'in_progress' ? <Clock size={15} /> : <Check size={15} />}
                </button>
                <div className="flex-1 min-w-[180px]">
                  <p className={`font-medium ${t.status === 'done' ? 'text-ink/40 line-through' : 'text-plum'}`}>{t.title}</p>
                  <p className="text-xs text-ink/50 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    {t.assignee_email && <span>{team.find((m) => m.email === t.assignee_email)?.name || t.assignee_email}</span>}
                    {t.due_date && <span className={isOverdue(t) ? 'text-terracotta font-medium' : ''}>{isOverdue(t) ? 'Overdue · ' : 'Due '}{fmtDate(t.due_date)}</span>}
                    {t.notes && <span className="text-ink/40">{t.notes}</span>}
                  </p>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${statusChip[t.status]}`}>{t.status.replace('_', ' ')}</span>
                {t.inquiry_id && (
                  <Link to={`/org/clients/${t.inquiry_id}`} className="text-xs text-terracotta inline-flex items-center gap-1 link-underline">
                    {t.client_name || 'Event'} <ArrowRight size={12} />
                  </Link>
                )}
                <button aria-label={`Delete ${t.title}`} disabled={busy || !canWrite}
                  onClick={() => { if (confirm(`Delete "${t.title}"?`)) run(() => api.orgTaskAction({ action: 'delete', id: t.id })) }}
                  className="text-xs rounded-full border border-terracotta/30 px-3 py-1.5 text-terracotta disabled:opacity-50">Delete</button>
              </div>
            ))}
          </div>

          {/* Add form */}
          <div className="rounded-3xl bg-cream-deep border border-plum/8 p-7 space-y-4 lg:sticky lg:top-28">
            <h2 className="font-display text-plum text-xl">Add a task</h2>
            <Field label="What needs doing?" required value={form.title} onChange={set('title')} placeholder="Confirm caterer headcount" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Due" type="date" value={form.due_date} onChange={set('due_date')} />
              <label className="block">
                <span className="block text-sm text-ink/70 mb-1.5">Assign to</span>
                <select value={form.assignee_email} onChange={set('assignee_email')} className="w-full rounded-xl border border-plum/15 bg-cream px-4 py-2.5 text-ink">
                  <option value="">Unassigned</option>
                  {team.map((m) => <option key={m.email} value={m.email}>{m.name || m.email}</option>)}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="block text-sm text-ink/70 mb-1.5">Event (optional)</span>
              <select value={form.inquiryId} onChange={set('inquiryId')} className="w-full rounded-xl border border-plum/15 bg-cream px-4 py-2.5 text-ink">
                <option value="">General — not tied to an event</option>
                {(data.inquiries || []).map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
              </select>
            </label>
            <Field label="Notes" value={form.notes} onChange={set('notes')} placeholder="Anything the assignee should know" />
            <Button disabled={!form.title || busy || !canWrite} onClick={add} variant="primary" size="sm"><Plus size={16} /> Add task</Button>
          </div>
        </Container>
      </Section>
    </>
  )
}
