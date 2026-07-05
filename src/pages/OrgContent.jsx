import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import Field from '../components/ui/Field.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { ArrowLeft, Spinner, Lock } from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'
import { useAuth } from '../lib/AuthContext.jsx'

const SECTIONS = [
  { type: 'process', label: 'Process steps', fields: [{ key: 'title', label: 'Title' }, { key: 'desc', label: 'Description', textarea: true }] },
  { type: 'faq', label: 'FAQ', fields: [{ key: 'q', label: 'Question' }, { key: 'a', label: 'Answer', textarea: true }] },
  { type: 'testimonial', label: 'Testimonials', fields: [{ key: 'quote', label: 'Quote', textarea: true }, { key: 'name', label: 'Name' }, { key: 'event', label: 'Event' }] },
]

function ItemEditor({ section, item, canWrite, onSaved, onDelete, isNew }) {
  const [f, setF] = useState(() => ({ ...item }))
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const save = async () => {
    setBusy(true)
    const data = {}
    for (const fl of section.fields) data[fl.key] = f[fl.key] || ''
    try {
      await api.orgContentAction({ action: isNew ? 'create' : 'update', id: isNew ? undefined : item.id, type: section.type, data, sort: parseInt(f.sort) || 0, published: f.published !== false })
      if (isNew) { const cleared = { sort: parseInt(f.sort) || 0, published: true }; setF(cleared) }
      onSaved()
    } catch { /* noop */ } finally { setBusy(false) }
  }
  return (
    <div className={`rounded-2xl border p-5 space-y-3 ${isNew ? 'border-dashed border-plum/20 bg-cream' : 'bg-cream-deep border-plum/8'}`}>
      {section.fields.map((fl) => (
        fl.textarea
          ? <Field key={fl.key} as="textarea" rows="2" label={fl.label} value={f[fl.key] || ''} onChange={(e) => set(fl.key, e.target.value)} />
          : <Field key={fl.key} label={fl.label} value={f[fl.key] || ''} onChange={(e) => set(fl.key, e.target.value)} />
      ))}
      <div className="flex flex-wrap items-center gap-4 text-sm text-ink/70">
        <label className="inline-flex items-center gap-2">Sort <input type="number" value={f.sort ?? 0} onChange={(e) => set('sort', e.target.value)} className="w-16 rounded-lg border border-plum/15 bg-cream px-2 py-1" /></label>
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={f.published !== false} onChange={(e) => set('published', e.target.checked)} /> Published</label>
        <div className="ml-auto flex items-center gap-2">
          {!isNew && <button type="button" onClick={onDelete} disabled={!canWrite} className="text-xs rounded-full border border-terracotta/30 px-3 py-1.5 text-terracotta disabled:opacity-50">Delete</button>}
          <Button onClick={save} variant={isNew ? 'outline' : 'primary'} size="sm" loading={busy} disabled={!canWrite}>{isNew ? 'Add' : 'Save'}</Button>
        </div>
      </div>
    </div>
  )
}

export default function OrgContent() {
  const { client } = useAuth()
  const canWrite = client?.canWrite !== false
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')

  const load = useCallback(async () => {
    try { setData(await api.orgContent()); setState('ok') }
    catch (e) { setState(e instanceof ApiError && (e.status === 401 || e.status === 403) ? 'forbidden' : 'error') }
  }, [])
  useEffect(() => { load() }, [load])

  const del = async (id) => { if (!confirm('Delete this item?')) return; try { await api.orgContentAction({ action: 'delete', id }); await load() } catch { /* noop */ } }

  if (state === 'loading') return <div className="min-h-dvh grid place-items-center text-plum"><Spinner size={32} /></div>
  if (state === 'forbidden') return (
    <Section tone="cream" className="min-h-dvh grid place-items-center"><Container className="text-center max-w-md">
      <Lock size={36} className="text-terracotta mx-auto" />
      <h1 className="font-display text-plum text-3xl mt-4">Organizer access only</h1>
      <Button to="/login" variant="primary" size="md" className="mt-6">Sign in</Button>
    </Container></Section>
  )
  if (state === 'error') return <div className="min-h-dvh grid place-items-center text-terracotta">Couldn&apos;t load content.</div>

  return (
    <>
      <Seo title="Content · Organizer" noindex />
      <section className="bg-plum-deep text-cream pt-32 pb-10">
        <Container>
          <Link to="/org" className="inline-flex items-center gap-2 text-cream/70 hover:text-cream text-sm mb-5"><ArrowLeft size={16} /> Dashboard</Link>
          <h1 className="font-display text-4xl sm:text-5xl">Content</h1>
          <p className="text-cream/70 mt-2">Edit the Process steps, FAQ, and testimonials shown on your public pages.</p>
        </Container>
      </section>

      <Section tone="cream" pad="md">
        <Container className="max-w-3xl space-y-12">
          {SECTIONS.map((sec) => (
            <div key={sec.type}>
              <h2 className="font-display text-plum text-2xl mb-4">{sec.label}</h2>
              <div className="space-y-3">
                {(data[sec.type] || []).map((item) => (
                  <ItemEditor key={item.id} section={sec} item={item} canWrite={canWrite} onSaved={load} onDelete={() => del(item.id)} />
                ))}
                {canWrite && (
                  <ItemEditor key={`new-${sec.type}`} section={sec} item={{ sort: (data[sec.type]?.length || 0) + 1, published: true }} canWrite={canWrite} onSaved={load} isNew />
                )}
              </div>
            </div>
          ))}
        </Container>
      </Section>
    </>
  )
}
