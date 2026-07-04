import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import Field from '../components/ui/Field.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { ArrowLeft, Spinner, Lock, Plus, CreditCard, Check, Clock, Calendar } from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'
import { formatMoney } from '../lib/money.js'
import { useAuth } from '../lib/AuthContext.jsx'

const BLANK = { vendor_name: '', category: 'misc', description: '', amount: '', inquiryId: '', receipt_url: '' }
const NEXT_STATUS = { planned: 'committed', committed: 'paid' }
const statusChip = {
  planned: 'bg-plum/5 text-ink/50',
  committed: 'bg-champagne/25 text-terracotta',
  paid: 'bg-kente/15 text-kente',
}
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const margin = (v) => <span className={`tnum ${v < 0 ? 'text-terracotta' : 'text-kente'}`}>{formatMoney(v, 'GHS')}</span>

function Stat({ Icon, label, value, accent }) {
  return (
    <div className="rounded-2xl bg-cream-deep border border-plum/8 p-6">
      <Icon size={22} className="text-terracotta" />
      <p className={`font-display text-3xl mt-3 tnum ${accent || 'text-plum'}`}>{value}</p>
      <p className="text-ink/55 text-sm">{label}</p>
    </div>
  )
}

export default function OrgBooks() {
  const { client } = useAuth()
  const canWrite = client?.canWrite !== false
  const [books, setBooks] = useState(null)
  const [exp, setExp] = useState(null)
  const [state, setState] = useState('loading')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [editId, setEditId] = useState(null)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try {
      const [b, e] = await Promise.all([api.orgBooks(), api.orgExpenses()])
      setBooks(b); setExp(e); setState('ok')
    } catch (e) { setState(e instanceof ApiError && (e.status === 403 || e.status === 401) ? 'forbidden' : 'error') }
  }, [])
  useEffect(() => { load() }, [load])

  const run = async (fn) => {
    setBusy(true); setErr('')
    try { await fn() }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Something went wrong.') }
    finally { setBusy(false); await load() }
  }
  const set = (k) => (e) => { const v = e.target.value; setForm((prev) => ({ ...prev, [k]: v })) }
  const reset = () => { setForm(BLANK); setEditId(null) }

  const save = () => run(async () => {
    await api.orgExpenseAction({ action: editId ? 'update' : 'create', id: editId, ...form })
    reset()
  })
  const edit = (e) => {
    setEditId(e.id)
    setForm({
      vendor_name: e.vendor_name || '', category: e.category, description: e.description || '',
      amount: e.amount ? e.amount / 100 : '', inquiryId: e.inquiry_id || '', receipt_url: e.receipt_url || '',
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
  if (state === 'error' || !books || !exp) return <div className="min-h-dvh grid place-items-center text-terracotta">Couldn't load the books.</div>

  const { totals, events } = books
  const expenses = exp.expenses || []

  return (
    <>
      <Seo title="Books · Organizer" noindex />
      <section className="bg-plum-deep text-cream pt-32 pb-10">
        <Container>
          <Link to="/org" className="inline-flex items-center gap-2 text-cream/70 hover:text-cream text-sm mb-5"><ArrowLeft size={16} /> Dashboard</Link>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="font-display text-4xl sm:text-5xl">Books</h1>
              <p className="text-cream/70 mt-2">Revenue, costs, and margins across every event — exportable any time.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {['events', 'payments', 'expenses'].map((k) => (
                <a key={k} href={`/api/org/books?export=${k}`}
                  className="text-sm rounded-full bg-cream/10 hover:bg-cream/20 text-cream px-4 py-1.5 transition-colors capitalize">
                  Export {k} CSV
                </a>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <Section tone="cream" pad="md">
        <Container>
          {err && <p role="alert" className="text-terracotta text-sm mb-4">{err}</p>}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <Stat Icon={CreditCard} label="Collected" value={formatMoney(totals.collected, 'GHS')} />
            <Stat Icon={Clock} label="Outstanding" value={formatMoney(totals.outstanding, 'GHS')} />
            <Stat Icon={Calendar} label="Costs paid" value={formatMoney(totals.costsPaid, 'GHS')} />
            <Stat Icon={Check} label="Projected margin" value={formatMoney(totals.projectedMargin, 'GHS')}
              accent={totals.projectedMargin < 0 ? 'text-terracotta' : 'text-kente'} />
          </div>

          <div className="grid lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-8">
              {/* Per-event books */}
              <div className="rounded-3xl bg-cream-deep border border-plum/8 p-6 sm:p-8 overflow-x-auto">
                <h2 className="font-display text-plum text-2xl mb-5">Per event</h2>
                {events.length === 0 ? <p className="text-ink/55 text-sm">No events yet.</p> : (
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-ink/45 text-xs uppercase tracking-wider">
                      <th className="pb-2 pr-4 font-medium">Client</th><th className="pb-2 pr-4 font-medium">Estimate</th>
                      <th className="pb-2 pr-4 font-medium">Collected</th><th className="pb-2 pr-4 font-medium">Costs</th>
                      <th className="pb-2 pr-4 font-medium">Margin</th><th className="pb-2 font-medium">Status</th>
                    </tr></thead>
                    <tbody>
                      {events.map((e) => (
                        <tr key={e.inquiry_id} className="border-t border-plum/8">
                          <td className="py-3 pr-4">
                            <Link to={`/org/clients/${e.inquiry_id}`} className="font-medium text-plum link-underline">{e.name}</Link>
                            <p className="text-ink/50 text-xs">{e.event_type}{e.event_date ? ` · ${fmtDate(e.event_date)}` : ''}</p>
                          </td>
                          <td className="py-3 pr-4 tnum text-plum">{formatMoney(e.estimate, 'GHS')}</td>
                          <td className="py-3 pr-4 tnum text-plum">{formatMoney(e.collected, 'GHS')}</td>
                          <td className="py-3 pr-4 tnum text-ink/70">{formatMoney(e.costs.total, 'GHS')}<p className="text-xs text-ink/45">{formatMoney(e.costs.paid, 'GHS')} paid</p></td>
                          <td className="py-3 pr-4">{margin(e.projectedMargin)}</td>
                          <td className="py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-plum/10 text-ink/60">{e.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {totals.generalCosts?.total > 0 && (
                  <p className="text-xs text-ink/50 mt-4 pt-3 border-t border-plum/8">
                    General (not tied to an event): {formatMoney(totals.generalCosts.total, 'GHS')} — {formatMoney(totals.generalCosts.paid, 'GHS')} paid.
                  </p>
                )}
              </div>

              {/* Expense list */}
              <div className="rounded-3xl bg-cream-deep border border-plum/8 p-6 sm:p-8">
                <h2 className="font-display text-plum text-2xl mb-5">Expenses</h2>
                {expenses.length === 0 ? <p className="text-ink/55 text-sm">No expenses recorded yet — add your first cost line.</p> : (
                  <ul className="space-y-3">
                    {expenses.map((e) => (
                      <li key={e.id} className="rounded-2xl border border-plum/8 p-4 flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-[180px]">
                          <p className="font-medium text-plum">{e.vendor_name || e.description || e.category}</p>
                          <p className="text-xs text-ink/50 capitalize">
                            {e.category} · {e.client_name ? `${e.client_name}${e.event_type ? ` (${e.event_type})` : ''}` : 'General'}
                            {e.description && e.vendor_name ? ` · ${e.description}` : ''}
                          </p>
                        </div>
                        <span className="font-display text-plum tnum">{formatMoney(e.amount, e.currency)}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${statusChip[e.status]}`}>{e.status}</span>
                        <div className="flex items-center gap-2">
                          {NEXT_STATUS[e.status] && (
                            <button disabled={busy || !canWrite} onClick={() => run(() => api.orgExpenseAction({ action: 'set_status', id: e.id, status: NEXT_STATUS[e.status] }))}
                              className="text-xs rounded-full bg-plum text-cream px-3 py-1.5 disabled:opacity-50">Mark {NEXT_STATUS[e.status]}</button>
                          )}
                          <button disabled={busy || !canWrite} onClick={() => edit(e)} className="text-xs rounded-full border border-plum/20 px-3 py-1.5 text-plum disabled:opacity-50">Edit</button>
                          <button disabled={busy || !canWrite} onClick={() => { if (confirm('Delete this expense?')) run(() => api.orgExpenseAction({ action: 'delete', id: e.id })) }}
                            className="text-xs rounded-full border border-terracotta/30 px-3 py-1.5 text-terracotta disabled:opacity-50">Delete</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Add/edit expense */}
            <div className="rounded-3xl bg-cream-deep border border-plum/8 p-7 space-y-4 lg:sticky lg:top-28">
              <h2 className="font-display text-plum text-xl">{editId ? 'Edit expense' : 'Record an expense'}</h2>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount (GH₵)" required type="number" value={form.amount} onChange={set('amount')} />
                <label className="block">
                  <span className="block text-sm text-ink/70 mb-1.5">Category</span>
                  <select value={form.category} onChange={set('category')} className="w-full rounded-xl border border-plum/15 bg-cream px-4 py-2.5 text-ink capitalize">
                    {(exp.categories || []).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              </div>
              <Field label="Vendor / payee" value={form.vendor_name} onChange={set('vendor_name')} placeholder="Bloom & Co. Florals" />
              <label className="block">
                <span className="block text-sm text-ink/70 mb-1.5">Event (optional)</span>
                <select value={form.inquiryId} onChange={set('inquiryId')} disabled={!!editId} className="w-full rounded-xl border border-plum/15 bg-cream px-4 py-2.5 text-ink disabled:opacity-60">
                  <option value="">General — not tied to an event</option>
                  {(exp.inquiries || []).map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
                </select>
              </label>
              <Field label="Description" value={form.description} onChange={set('description')} placeholder="Centerpieces & arch florals" />
              <Field label="Receipt URL" value={form.receipt_url} onChange={set('receipt_url')} placeholder="https://…" />
              <div className="flex gap-2">
                <Button disabled={!form.amount || busy || !canWrite} onClick={save} variant="primary" size="sm">{editId ? 'Save' : <><Plus size={16} /> Add</>}</Button>
                {editId && <Button onClick={reset} variant="outline" size="sm">Cancel</Button>}
              </div>
              <p className="text-xs text-ink/45">Planned → committed → paid. Planned and committed lines are your budget; paid is money out the door.</p>
            </div>
          </div>
        </Container>
      </Section>
    </>
  )
}
