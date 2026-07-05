import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import Field from '../components/ui/Field.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { ArrowLeft, ArrowRight, Spinner, Lock, CheckCircle } from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'
import { toMinor } from '../lib/money.js'
import { useAuth } from '../lib/AuthContext.jsx'

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const EMPTY = { title: '', host_names: '', event_type: 'Wedding', event_date: '', venue: '', location: '', goal: '' }

export default function OrgEvents() {
  const { client } = useAuth()
  const canWrite = client?.canWrite !== false
  const [events, setEvents] = useState([])
  const [state, setState] = useState('loading')
  const [f, setF] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [made, setMade] = useState(null)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try { const r = await api.orgEvents(); setEvents(r.events || []); setState('ok') }
    catch (e) { setState(e instanceof ApiError && (e.status === 401 || e.status === 403) ? 'forbidden' : 'error') }
  }, [])
  useEffect(() => { load() }, [load])

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const create = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      const res = await api.orgEventAction({ action: 'create', ...f, contribution_goal: toMinor(parseFloat(f.goal) || 0, 'GHS') })
      setMade(res.slug); setF(EMPTY); await load()
    } catch (e2) { setErr(e2 instanceof ApiError ? e2.message : 'Could not create the event.') }
    finally { setBusy(false) }
  }
  const remove = async (ev) => {
    if (!confirm(`Delete the event page "${ev.title}"? This can't be undone.`)) return
    try { await api.orgEventAction({ action: 'delete', id: ev.id }); await load() } catch { /* noop */ }
  }

  if (state === 'loading') return <div className="min-h-dvh grid place-items-center text-plum"><Spinner size={32} /></div>
  if (state === 'forbidden') return (
    <Section tone="cream" className="min-h-dvh grid place-items-center"><Container className="text-center max-w-md">
      <Lock size={36} className="text-terracotta mx-auto" />
      <h1 className="font-display text-plum text-3xl mt-4">Organizer access only</h1>
      <Button to="/login" variant="primary" size="md" className="mt-6">Sign in</Button>
    </Container></Section>
  )
  if (state === 'error') return <div className="min-h-dvh grid place-items-center text-terracotta">Couldn&apos;t load events.</div>

  return (
    <>
      <Seo title="Events · Organizer" noindex />
      <section className="bg-plum-deep text-cream pt-32 pb-10">
        <Container>
          <Link to="/org" className="inline-flex items-center gap-2 text-cream/70 hover:text-cream text-sm mb-5"><ArrowLeft size={16} /> Dashboard</Link>
          <h1 className="font-display text-4xl sm:text-5xl">Events</h1>
          <p className="text-cream/70 mt-2">Create and manage shareable event pages.</p>
        </Container>
      </section>

      <Section tone="cream" pad="md">
        <Container className="grid lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-3">
            {events.length === 0 ? (
              <div className="rounded-3xl bg-cream-deep border border-plum/8 p-8 text-ink/55">No event pages yet — create your first one.</div>
            ) : events.map((e) => (
              <div key={e.id} className="rounded-2xl bg-cream-deep border border-plum/8 p-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-plum">{e.host_names || e.title}</p>
                  <p className="text-ink/50 text-xs">{e.event_type || 'Event'} · {fmtDate(e.event_date)} · {e.visibility}</p>
                </div>
                <div className="flex items-center gap-3">
                  <a href={`/e/${e.slug}`} target="_blank" rel="noopener noreferrer" className="text-terracotta text-sm inline-flex items-center gap-1 link-underline">View <ArrowRight size={14} /></a>
                  <button onClick={() => remove(e)} disabled={!canWrite} className="text-xs rounded-full border border-terracotta/30 px-3 py-1.5 text-terracotta disabled:opacity-50">Delete</button>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:sticky lg:top-28">
            {made ? (
              <div className="rounded-3xl bg-plum text-cream p-7">
                <CheckCircle size={28} className="text-champagne-light" />
                <p className="mt-2">Event page created.</p>
                <a href={`/e/${made}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-champagne-light link-underline">/e/{made} <ArrowRight size={16} /></a>
                <button onClick={() => setMade(null)} className="block mt-4 text-sm text-cream/70 link-underline">Create another</button>
              </div>
            ) : (
              <form onSubmit={create} className="rounded-3xl bg-cream-deep border border-plum/8 p-7 space-y-4">
                <h2 className="font-display text-plum text-xl">Create an event page</h2>
                <Field label="Title" required value={f.title} onChange={set('title')} placeholder="The Wedding of Ama & Kojo" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Host names" value={f.host_names} onChange={set('host_names')} placeholder="Ama & Kojo" />
                  <Field label="Type" value={f.event_type} onChange={set('event_type')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date" type="date" value={f.event_date} onChange={set('event_date')} />
                  <Field label="Goal (GH₵)" type="number" value={f.goal} onChange={set('goal')} placeholder="20000" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Venue" value={f.venue} onChange={set('venue')} />
                  <Field label="Location" value={f.location} onChange={set('location')} />
                </div>
                {err && <p role="alert" className="text-sm text-terracotta">{err}</p>}
                <Button type="submit" variant="primary" size="sm" loading={busy} disabled={!canWrite} className="w-full">Create page</Button>
              </form>
            )}
          </div>
        </Container>
      </Section>
    </>
  )
}
