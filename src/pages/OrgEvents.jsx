import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import Field from '../components/ui/Field.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { ArrowLeft, ArrowRight, Spinner, Lock, CheckCircle } from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'
import { fromMinor, toMinor } from '../lib/money.js'
import { useAuth } from '../lib/AuthContext.jsx'

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const EMPTY = { title: '', host_names: '', event_type: 'Wedding', event_date: '', venue: '', location: '', goal: '' }

const DELIVERY = ['pending', 'booked', 'delivered']

function FundingLines({ event, canWrite }) {
  const [lines, setLines] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [draft, setDraft] = useState({ label: '', goal: '' })
  const [pickQuote, setPickQuote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { const r = await api.orgEventLines(event.id); setLines(r.lines || []) } catch { setLines([]) }
  }, [event.id])
  useEffect(() => { load(); api.orgEventQuotes().then((r) => setQuotes(r.quotes || [])).catch(() => {}) }, [load])

  const act = async (payload) => { setBusy(true); try { await api.orgEventAction(payload); await load() } catch { /* noop */ } finally { setBusy(false) } }
  const addLine = async () => {
    if (!draft.label.trim()) return
    await act({ action: 'line_upsert', eventId: event.id, label: draft.label, target_amount: toMinor(parseFloat(draft.goal) || 0, 'GHS'), sort: (lines?.length || 0) })
    setDraft({ label: '', goal: '' })
  }

  if (lines === null) return <p className="text-ink/40 text-xs mt-3">Loading funding lines…</p>

  return (
    <div className="mt-4 pt-4 border-t border-plum/10 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wider text-ink/45">Funding lines</p>
        {canWrite && quotes.length > 0 && (
          <div className="flex items-center gap-2">
            <select value={pickQuote} onChange={(e) => setPickQuote(e.target.value)} className="text-xs rounded-lg border border-plum/15 bg-cream px-2 py-1">
              <option value="">Import from a lead…</option>
              {quotes.map((q) => <option key={q.inquiryId} value={q.inquiryId}>{q.label}</option>)}
            </select>
            <button type="button" disabled={!pickQuote || busy} onClick={() => act({ action: 'import_lines', eventId: event.id, inquiryId: pickQuote })}
              className="text-xs rounded-full bg-plum text-cream px-3 py-1.5 disabled:opacity-50">Import</button>
          </div>
        )}
      </div>

      {lines.length === 0 ? <p className="text-ink/45 text-xs">No lines yet — import from a lead's quote or add one below.</p> : (
        <ul className="space-y-2">
          {lines.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="flex-1 min-w-[120px] text-ink/80">{l.label} {l.visible ? '' : <span className="text-ink/40 text-xs">(hidden)</span>}</span>
              <span className="tnum text-plum">{fromMinor(l.target_amount, 'GHS')} GH₵</span>
              <select value={l.delivery_status} disabled={!canWrite} onChange={(e) => act({ action: 'line_delivery', id: l.id, delivery_status: e.target.value })}
                className="text-xs rounded-lg border border-plum/15 bg-cream px-2 py-1">
                {DELIVERY.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <button type="button" disabled={!canWrite} onClick={() => act({ action: 'line_upsert', id: l.id, label: l.label, target_amount: l.target_amount, sort: l.sort, visible: l.visible ? false : true })}
                className="text-xs text-ink/50 link-underline disabled:opacity-50">{l.visible ? 'Hide' : 'Show'}</button>
              <button type="button" disabled={!canWrite} onClick={() => act({ action: 'line_delete', id: l.id })}
                className="text-xs text-terracotta link-underline disabled:opacity-50">Delete</button>
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <div className="flex flex-wrap items-end gap-2 pt-1">
          <Field className="flex-1 min-w-[140px]" label="New line" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Catering" />
          <Field label="Target (GH₵)" type="number" value={draft.goal} onChange={(e) => setDraft({ ...draft, goal: e.target.value })} />
          <Button onClick={addLine} variant="outline" size="sm" loading={busy}>Add</Button>
        </div>
      )}
    </div>
  )
}

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
  const accept = async (ev) => { try { await api.orgEventAction({ action: 'accept_self_serve', id: ev.id }); await load() } catch { /* noop */ } }

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
              <div key={e.id} className="rounded-2xl bg-cream-deep border border-plum/8 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-plum">
                      {e.host_names || e.title}
                      {e.self_serve === 1 && e.contributions_enabled === 0 && (
                        <span className="ml-2 align-middle text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-champagne/25 text-terracotta">Pending funding</span>
                      )}
                    </p>
                    <p className="text-ink/50 text-xs">{e.event_type || 'Event'} · {fmtDate(e.event_date)} · {e.visibility}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {canWrite && e.self_serve === 1 && e.contributions_enabled === 0 && (
                      <button onClick={() => accept(e)} className="text-xs rounded-full bg-plum text-cream px-3 py-1.5 hover:bg-plum-soft transition-colors">Accept &amp; enable funding</button>
                    )}
                    <a href={`/e/${e.slug}`} target="_blank" rel="noopener noreferrer" className="text-terracotta text-sm inline-flex items-center gap-1 link-underline">View <ArrowRight size={14} /></a>
                    <button onClick={() => remove(e)} disabled={!canWrite} className="text-xs rounded-full border border-terracotta/30 px-3 py-1.5 text-terracotta disabled:opacity-50">Delete</button>
                  </div>
                </div>
                <FundingLines event={e} canWrite={canWrite} />
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
