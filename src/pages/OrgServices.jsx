import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import Field from '../components/ui/Field.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { ArrowLeft, Spinner, Lock, Plus, Close } from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'
import { useAuth } from '../lib/AuthContext.jsx'

const BLANK = { id: null, name: '', tagline: '', description: '', image: '', features: [''], price_from: '', featured: false, published: true, sort: 0 }

export default function OrgServices() {
  const { client } = useAuth()
  const canWrite = client?.canWrite !== false
  const [services, setServices] = useState([])
  const [state, setState] = useState('loading')
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try { const r = await api.orgServices(); setServices(r.services || []); setState('ok') }
    catch (e) { setState(e instanceof ApiError && (e.status === 401 || e.status === 403) ? 'forbidden' : 'error') }
  }, [])
  useEffect(() => { load() }, [load])

  const startNew = () => { setErr(''); setEditing({ ...BLANK, sort: services.length + 1 }) }
  const startEdit = (s) => { setErr(''); setEditing({ ...s, price_from: String(s.price_from ?? ''), features: s.features?.length ? s.features : [''] }) }
  const setF = (k, v) => setEditing((e) => ({ ...e, [k]: v }))
  const setFeat = (i, v) => setEditing((e) => ({ ...e, features: e.features.map((x, j) => (j === i ? v : x)) }))
  const addFeat = () => setEditing((e) => ({ ...e, features: [...e.features, ''] }))
  const rmFeat = (i) => setEditing((e) => ({ ...e, features: e.features.filter((_, j) => j !== i) }))

  const save = async (ev) => {
    ev.preventDefault(); setBusy(true); setErr('')
    const payload = {
      action: editing.id ? 'update' : 'create', id: editing.id || undefined,
      name: editing.name, tagline: editing.tagline, description: editing.description, image: editing.image,
      features: editing.features.map((f) => f.trim()).filter(Boolean),
      price_from: parseInt(editing.price_from) || 0, featured: editing.featured, published: editing.published, sort: parseInt(editing.sort) || 0,
    }
    try { await api.orgServiceAction(payload); setEditing(null); await load() }
    catch (e2) { setErr(e2 instanceof ApiError ? e2.message : 'Could not save.') }
    finally { setBusy(false) }
  }
  const remove = async (s) => {
    if (!confirm(`Delete the service "${s.name}"?`)) return
    try { await api.orgServiceAction({ action: 'delete', id: s.id }); await load() } catch { /* noop */ }
  }

  if (state === 'loading') return <div className="min-h-dvh grid place-items-center text-plum"><Spinner size={32} /></div>
  if (state === 'forbidden') return (
    <Section tone="cream" className="min-h-dvh grid place-items-center"><Container className="text-center max-w-md">
      <Lock size={36} className="text-terracotta mx-auto" />
      <h1 className="font-display text-plum text-3xl mt-4">Organizer access only</h1>
      <Button to="/login" variant="primary" size="md" className="mt-6">Sign in</Button>
    </Container></Section>
  )
  if (state === 'error') return <div className="min-h-dvh grid place-items-center text-terracotta">Couldn&apos;t load services.</div>

  return (
    <>
      <Seo title="Services · Organizer" noindex />
      <section className="bg-plum-deep text-cream pt-32 pb-10">
        <Container>
          <Link to="/org" className="inline-flex items-center gap-2 text-cream/70 hover:text-cream text-sm mb-5"><ArrowLeft size={16} /> Dashboard</Link>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl sm:text-5xl">Services</h1>
              <p className="text-cream/70 mt-2">Manage the offerings and pricing on your public Services page.</p>
            </div>
            <Button onClick={startNew} disabled={!canWrite} variant="gold" size="sm"><Plus size={16} /> New service</Button>
          </div>
        </Container>
      </section>

      <Section tone="cream" pad="md">
        <Container className="grid lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-3">
            {services.length === 0 ? (
              <div className="rounded-3xl bg-cream-deep border border-plum/8 p-8 text-ink/55">No services yet — add your first offering.</div>
            ) : services.map((s) => (
              <div key={s.id} className="rounded-2xl bg-cream-deep border border-plum/8 p-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-plum">{s.name} <span className="text-ink/40 text-sm tnum">· from GH₵ {Number(s.price_from || 0).toLocaleString()}</span></p>
                  <p className="text-ink/50 text-xs">sort {s.sort}{s.featured ? ' · Featured' : ''}{s.published ? '' : ' · Hidden'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit(s)} disabled={!canWrite} className="text-xs rounded-full border border-plum/20 px-3 py-1.5 text-plum disabled:opacity-50">Edit</button>
                  <button onClick={() => remove(s)} disabled={!canWrite} className="text-xs rounded-full border border-terracotta/30 px-3 py-1.5 text-terracotta disabled:opacity-50">Delete</button>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:sticky lg:top-28">
            {!editing ? (
              <div className="rounded-3xl bg-cream-deep border border-plum/8 p-7 text-ink/55 text-sm">Select a service to edit, or add a new one.</div>
            ) : (
              <form onSubmit={save} className="rounded-3xl bg-cream-deep border border-plum/8 p-7 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-plum text-xl">{editing.id ? 'Edit service' : 'New service'}</h2>
                  <button type="button" onClick={() => setEditing(null)} className="text-ink/50 hover:text-plum"><Close size={18} /></button>
                </div>
                <Field label="Name" required value={editing.name} onChange={(e) => setF('name', e.target.value)} placeholder="Weddings" />
                <Field label="Tagline" value={editing.tagline} onChange={(e) => setF('tagline', e.target.value)} placeholder="Full planning, design & day-of coordination" />
                <Field as="textarea" rows="3" label="Description" value={editing.description} onChange={(e) => setF('description', e.target.value)} />
                <Field label="Image URL" value={editing.image} onChange={(e) => setF('image', e.target.value)} placeholder="https://…" />
                <div>
                  <label className="block text-sm text-ink/60 mb-2">What&apos;s included</label>
                  <div className="space-y-2">
                    {editing.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input value={f} onChange={(e) => setFeat(i, e.target.value)} className="flex-1 rounded-xl border border-plum/15 bg-cream px-3 py-2 text-plum text-sm" placeholder="Concept & design direction" />
                        <button type="button" onClick={() => rmFeat(i)} className="text-ink/40 hover:text-terracotta"><Close size={16} /></button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addFeat} className="mt-2 text-sm text-terracotta inline-flex items-center gap-1"><Plus size={14} /> Add item</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="From (GH₵)" type="number" value={editing.price_from} onChange={(e) => setF('price_from', e.target.value)} placeholder="35000" />
                  <Field label="Sort" type="number" value={editing.sort} onChange={(e) => setF('sort', e.target.value)} />
                </div>
                <div className="flex items-center gap-5 text-sm text-ink/70">
                  <label className="inline-flex items-center gap-2"><input type="checkbox" checked={editing.featured} onChange={(e) => setF('featured', e.target.checked)} /> Featured</label>
                  <label className="inline-flex items-center gap-2"><input type="checkbox" checked={editing.published} onChange={(e) => setF('published', e.target.checked)} /> Published</label>
                </div>
                {err && <p role="alert" className="text-sm text-terracotta">{err}</p>}
                <Button type="submit" variant="primary" size="sm" loading={busy} disabled={!canWrite} className="w-full">{editing.id ? 'Save changes' : 'Create service'}</Button>
              </form>
            )}
          </div>
        </Container>
      </Section>
    </>
  )
}
