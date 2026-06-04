import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import Field from '../components/ui/Field.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { ArrowLeft, Spinner, Lock, Plus, CheckCircle } from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'
import { formatMoney } from '../lib/money.js'

const BLANK = { name: '', category: 'catering', location: '', tagline: '', about: '', image: '', price_from: '', whatsapp: '' }

export default function OrgVendors() {
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [editId, setEditId] = useState(null)

  const load = useCallback(async () => {
    try { setData(await api.orgVendors()); setState('ok') }
    catch (e) { setState(e instanceof ApiError && (e.status === 403 || e.status === 401) ? 'forbidden' : 'error') }
  }, [])
  useEffect(() => { load() }, [load])

  const run = async (fn) => { setBusy(true); try { await fn() } finally { setBusy(false); await load() } }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const reset = () => { setForm(BLANK); setEditId(null) }

  const save = () => run(async () => {
    await api.orgVendorAction({ action: editId ? 'update' : 'create', id: editId, ...form })
    reset()
  })
  const edit = (v) => {
    setEditId(v.id)
    setForm({
      name: v.name, category: v.category, location: v.location || '', tagline: v.tagline || '',
      about: v.about || '', image: v.image || '', price_from: v.price_from ? v.price_from / 100 : '',
      whatsapp: v.whatsapp || '',
    })
  }

  if (state === 'loading') return <div className="min-h-dvh grid place-items-center text-plum"><Spinner size={32} /></div>
  if (state === 'forbidden') return (
    <Section tone="cream" className="min-h-dvh grid place-items-center"><Container className="text-center max-w-md">
      <Lock size={36} className="text-terracotta mx-auto" />
      <h1 className="font-display text-plum text-3xl mt-4">Organizer access only</h1>
      <Button to="/login" variant="primary" size="md" className="mt-6">Sign in</Button>
    </Container></Section>
  )
  if (state === 'error' || !data) return <div className="min-h-dvh grid place-items-center text-terracotta">Couldn't load vendors.</div>

  const cats = data.categories || []

  return (
    <>
      <Seo title="Vendors · Organizer" noindex />
      <section className="bg-plum-deep text-cream pt-32 pb-10">
        <Container>
          <Link to="/org" className="inline-flex items-center gap-2 text-cream/70 hover:text-cream text-sm mb-5"><ArrowLeft size={16} /> Dashboard</Link>
          <h1 className="font-display text-4xl sm:text-5xl">Vendor catalog</h1>
          <p className="text-cream/70 mt-2">Add, edit, and verify marketplace vendors.</p>
        </Container>
      </section>

      <Section tone="cream" pad="md">
        <Container className="grid lg:grid-cols-3 gap-8 items-start">
          {/* List */}
          <div className="lg:col-span-2 space-y-3">
            {data.vendors.length === 0 ? <p className="text-ink/55 text-sm">No vendors yet — add one.</p> : data.vendors.map((v) => (
              <div key={v.id} className="rounded-2xl bg-cream-deep border border-plum/8 p-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-plum flex items-center gap-2">
                    {v.name}
                    {v.verified ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-kente/15 text-kente inline-flex items-center gap-1"><CheckCircle size={12} /> Verified</span> : null}
                  </p>
                  <p className="text-ink/50 text-xs capitalize">{v.category}{v.location ? ` · ${v.location}` : ''} · from {formatMoney(v.price_from, v.currency)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button disabled={busy} onClick={() => run(() => api.orgVendorAction({ action: 'verify', id: v.id, verified: !v.verified }))} className="text-xs rounded-full border border-plum/20 px-3 py-1.5 text-plum disabled:opacity-50">{v.verified ? 'Unverify' : 'Verify'}</button>
                  <button disabled={busy} onClick={() => edit(v)} className="text-xs rounded-full border border-plum/20 px-3 py-1.5 text-plum disabled:opacity-50">Edit</button>
                  <button disabled={busy} onClick={() => { if (confirm(`Delete ${v.name}?`)) run(() => api.orgVendorAction({ action: 'delete', id: v.id })) }} className="text-xs rounded-full border border-terracotta/30 px-3 py-1.5 text-terracotta disabled:opacity-50">Delete</button>
                </div>
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="rounded-3xl bg-cream-deep border border-plum/8 p-7 space-y-4 lg:sticky lg:top-28">
            <h2 className="font-display text-plum text-xl">{editId ? 'Edit vendor' : 'Add vendor'}</h2>
            <Field label="Name" required value={form.name} onChange={set('name')} placeholder="Bloom & Co. Florals" />
            <label className="block">
              <span className="block text-sm text-ink/70 mb-1.5">Category</span>
              <select value={form.category} onChange={set('category')} className="w-full rounded-xl border border-plum/15 bg-cream px-4 py-2.5 text-ink capitalize">
                {cats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <Field label="Location" value={form.location} onChange={set('location')} placeholder="Accra" />
            <Field label="Tagline" value={form.tagline} onChange={set('tagline')} placeholder="Timeless florals for timeless days" />
            <Field label="Image URL" value={form.image} onChange={set('image')} placeholder="https://…" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="From (GH₵)" type="number" value={form.price_from} onChange={set('price_from')} />
              <Field label="WhatsApp" value={form.whatsapp} onChange={set('whatsapp')} placeholder="+233…" />
            </div>
            <Field label="About" value={form.about} onChange={set('about')} placeholder="Short description" />
            <div className="flex gap-2">
              <Button disabled={!form.name || busy} onClick={save} variant="primary" size="sm">{editId ? 'Save' : <><Plus size={16} /> Add</>}</Button>
              {editId && <Button onClick={reset} variant="outline" size="sm">Cancel</Button>}
            </div>
          </div>
        </Container>
      </Section>
    </>
  )
}
