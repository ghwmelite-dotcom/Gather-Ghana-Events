import { useState } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import Field from '../components/ui/Field.jsx'
import Reveal from '../components/ui/Reveal.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { Sparkles, ArrowRight, Spinner } from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'
import { useCurrency } from '../lib/CurrencyContext.jsx'
import { img } from '../lib/images.js'

const TYPES = ['Wedding', 'Birthday', 'Corporate', 'Other']
const VENDOR_LABELS = { venue: 'Venues', catering: 'Catering', decor: 'Décor', photography: 'Photography', music: 'Music & DJs', makeup: 'Makeup' }
const PRIORITIES = [
  { key: 'venue', label: 'Venue' },
  { key: 'catering', label: 'Catering' },
  { key: 'decor', label: 'Décor & styling' },
  { key: 'photography', label: 'Photography' },
  { key: 'music', label: 'Music' },
  { key: 'beauty', label: 'Beauty' },
]

export default function Concierge() {
  const { fmtGhs } = useCurrency()
  const [form, setForm] = useState({ eventType: 'Wedding', guests: 150, budget: 50000, culture: 'Ghanaian', vibe: '' })
  const [priorities, setPriorities] = useState([])
  const togglePriority = (k) =>
    setPriorities((p) => (p.includes(k) ? p.filter((x) => x !== k) : p.length < 2 ? [...p, k] : p))
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const generate = async (e) => {
    e.preventDefault()
    setLoading(true); setError(''); setPlan(null)
    try {
      const res = await api.concept({ ...form, guests: Number(form.guests), budget: Number(form.budget), priorities })
      setPlan(res.plan)
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Seo title="Akwaaba AI Concierge" description="Describe your dream event and get an instant concept — budget breakdown, run-of-show, palette, and a vendor shortlist." />
      <PageHeader
        eyebrow="Akwaaba · AI Concierge"
        title={<>Your event, <span className="italic text-champagne-light">imagined</span> in seconds</>}
        subtitle="Tell us a little, and we'll sketch a concept — budget, timeline, palette, and vendors — to build from."
        image={img.celebrations.src}
      />

      <Section tone="cream">
        <Container className="grid lg:grid-cols-5 gap-10 items-start">
          {/* Input */}
          <form onSubmit={generate} className="lg:col-span-2 rounded-3xl bg-cream-deep border border-plum/8 p-8 space-y-5 lg:sticky lg:top-28">
            <div>
              <label className="block text-sm text-ink/60 mb-3">Event type</label>
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map((t) => (
                  <button key={t} type="button" onClick={() => setForm({ ...form, eventType: t })}
                    className={`py-2.5 rounded-xl border text-sm ${form.eventType === t ? 'border-plum bg-plum text-cream' : 'border-plum/20 text-ink/70 hover:border-plum/50'}`}>{t}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Guests" type="number" min="1" inputMode="numeric" value={form.guests} onChange={set('guests')} />
              <Field label="Budget (GH₵)" type="number" min="0" inputMode="numeric" value={form.budget} onChange={set('budget')} />
            </div>
            <Field label="Culture / tradition" value={form.culture} onChange={set('culture')} placeholder="e.g. Ghanaian, Yoruba…" />
            <Field as="textarea" rows="3" label="The vibe you're dreaming of" value={form.vibe} onChange={set('vibe')} placeholder="Romantic garden, gold & plum, live highlife band…" />
            <div>
              <label className="block text-sm text-ink/60 mb-3">Top priorities <span className="text-ink/40">(pick up to 2)</span></label>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((p) => (
                  <button key={p.key} type="button" onClick={() => togglePriority(p.key)}
                    aria-pressed={priorities.includes(p.key)}
                    className={`px-3 py-2 rounded-full border text-sm transition-all ${priorities.includes(p.key) ? 'border-plum bg-plum text-cream' : 'border-plum/20 text-ink/70 hover:border-plum/50'}`}>{p.label}</button>
                ))}
              </div>
            </div>
            {error && <p role="alert" className="text-sm text-terracotta">{error}</p>}
            <Button type="submit" variant="primary" size="md" loading={loading} className="w-full"><Sparkles size={18} /> {loading ? 'Imagining…' : 'Generate my concept'}</Button>
          </form>

          {/* Output */}
          <div className="lg:col-span-3">
            {loading ? (
              <div className="grid place-items-center py-24 text-plum"><Spinner size={32} /></div>
            ) : !plan ? (
              <div className="rounded-3xl border border-dashed border-plum/20 p-12 text-center text-ink/50">
                <Sparkles size={32} className="mx-auto text-champagne" />
                <p className="mt-3">Your concept will appear here.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <Reveal className="rounded-3xl bg-plum text-cream p-8">
                  <div className="flex items-center justify-between">
                    <p className="font-display italic text-champagne-light text-xl">Your concept</p>
                    <div className="flex gap-1.5">{plan.palette.map((c) => <span key={c} className="w-6 h-6 rounded-full border border-cream/30" style={{ background: c }} />)}</div>
                  </div>
                  <p className="mt-4 text-cream/85 leading-relaxed">{plan.concept}</p>
                  <p className="mt-3 text-xs text-cream/45">{plan.aiUsed ? 'Crafted with AI' : 'Crafted from our planning playbooks'}</p>
                </Reveal>

                <Reveal className="rounded-3xl bg-cream-deep border border-plum/8 p-8" delay={80}>
                  <div className="flex items-baseline justify-between mb-5">
                    <h2 className="font-display text-plum text-2xl">Budget breakdown</h2>
                    <span className="text-sm text-ink/55 tnum">~{fmtGhs(plan.perGuest)}/guest</span>
                  </div>
                  <p className="text-xs text-ink/45 mb-4">Indicative — your planner confirms final pricing.</p>
                  <ul className="space-y-3">
                    {plan.budgetSplit.map((b) => (
                      <li key={b.label}>
                        <div className="flex justify-between text-sm mb-1"><span className="text-ink/70">{b.label}</span><span className="text-plum tnum">{fmtGhs(b.amount)}</span></div>
                        <div className="h-2 rounded-full bg-plum/10 overflow-hidden"><div className="h-full bg-champagne rounded-full" style={{ width: `${b.pct}%` }} /></div>
                        {b.suggestions?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {b.suggestions.map((s) => (
                              <Link key={s.slug} to={`/vendors/${s.slug}`} className="text-xs px-2.5 py-1 rounded-full bg-cream border border-plum/15 text-plum hover:bg-plum/5 transition-colors">
                                {s.name}{s.priceFrom ? ` · from ${fmtGhs(s.priceFrom / 100)}` : ''}
                              </Link>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </Reveal>

                <div className="grid sm:grid-cols-2 gap-6">
                  <Reveal className="rounded-3xl bg-cream-deep border border-plum/8 p-7" delay={120}>
                    <h2 className="font-display text-plum text-xl mb-4">Run-of-show</h2>
                    <ul className="space-y-2.5">
                      {plan.timeline.map((t, i) => (
                        <li key={i} className="flex gap-3 text-sm"><span className="text-terracotta w-20 shrink-0">{t.time}</span><span className="text-ink/75">{t.title}</span></li>
                      ))}
                    </ul>
                  </Reveal>
                  <Reveal className="rounded-3xl bg-cream-deep border border-plum/8 p-7" delay={160}>
                    <h2 className="font-display text-plum text-xl mb-4">Vendors to book</h2>
                    <div className="flex flex-wrap gap-2">
                      {plan.vendors.map((v) => (
                        <Link key={v} to={`/vendors?category=${v}`} className="px-3 py-1.5 rounded-full bg-plum/5 border border-plum/15 text-sm text-plum hover:bg-plum/10 transition-colors">{VENDOR_LABELS[v] || v}</Link>
                      ))}
                    </div>
                  </Reveal>
                </div>

                <div className="rounded-3xl bg-champagne-pale p-7 text-center">
                  <p className="font-display text-plum text-xl">Love where this is going?</p>
                  <Button to="/book" variant="primary" size="md" className="mt-4">Bring it to life <ArrowRight size={18} /></Button>
                </div>
              </div>
            )}
          </div>
        </Container>
      </Section>
    </>
  )
}
