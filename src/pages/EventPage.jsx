import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import Field from '../components/ui/Field.jsx'
import Img from '../components/ui/Img.jsx'
import Reveal from '../components/ui/Reveal.jsx'
import { Section, Container, Eyebrow } from '../components/ui/Section.jsx'
import KenteBand from '../components/ui/KenteBand.jsx'
import {
  Calendar, MapPin, Users, Heart, CheckCircle, Spinner, ArrowRight, WhatsApp, CreditCard,
} from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'
import { formatMoney, fromMinor, toMinor } from '../lib/money.js'
import { isEmail } from '../lib/validate.js'

function useCountdown(dateStr) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])
  if (!dateStr) return null
  const target = new Date(dateStr).getTime()
  if (isNaN(target)) return null
  const diff = target - now
  if (diff <= 0) return { past: true }
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  return { days, hours, past: false }
}

function fmtDate(d) {
  if (!d) return ''
  const p = new Date(d)
  return isNaN(p) ? d : p.toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function ShareRow({ title }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? window.location.href : ''
  const wa = `https://wa.me/?text=${encodeURIComponent(`You're invited: ${title} — ${url}`)}`
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* noop */ }
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a href={wa} className="inline-flex items-center gap-2 rounded-full bg-[#25D366] text-white px-5 py-2.5 text-sm hover:opacity-90 transition-opacity">
        <WhatsApp size={16} /> Share on WhatsApp
      </a>
      <button onClick={copy} className="inline-flex items-center gap-2 rounded-full border border-cream/30 text-cream px-5 py-2.5 text-sm hover:bg-cream/10 transition-colors">
        {copied ? <><CheckCircle size={16} /> Link copied</> : 'Copy link'}
      </button>
    </div>
  )
}

function ContributionPool({ slug, event, data, lineItems = [] }) {
  const cur = event.currency
  const { raised, goal, gifts, recent } = data
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : null
  const chips = [50, 100, 200, 500].map((n) => toMinor(n, cur))

  const [amount, setAmount] = useState(toMinor(100, cur))
  const [form, setForm] = useState({ name: '', email: '', message: '', anonymous: false })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [lineId, setLineId] = useState(null)
  const selectedLine = lineItems.find((l) => l.id === lineId) || null

  const give = async (e) => {
    e.preventDefault()
    if (!isEmail(form.email)) return setErr('Enter a valid email for your receipt.')
    if (amount < toMinor(5, cur)) return setErr('Please choose a larger amount.')
    setBusy(true); setErr('')
    try {
      const res = await api.contribute(slug, { ...form, amount, lineItemId: lineId })
      if (res?.authorization_url) { window.location.href = res.authorization_url; return }
      setErr('Could not start the payment. Please try again.'); setBusy(false)
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Something went wrong.'); setBusy(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start">
      {lineItems.length > 0 && (
        <div className="lg:col-span-2 rounded-3xl bg-cream-deep border border-plum/8 p-6">
          <h3 className="font-display text-plum text-xl mb-1">Fund a specific part</h3>
          <p className="text-ink/55 text-sm mb-4">Choose what your gift goes toward — or give to the whole celebration.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {lineItems.map((l) => (
              <button key={l.id} type="button" onClick={() => setLineId(lineId === l.id ? null : l.id)}
                className={`text-left rounded-2xl border p-4 transition-colors ${lineId === l.id ? 'border-plum bg-plum/5' : 'border-plum/12 hover:border-plum/40'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-plum">{l.label}</span>
                  {l.delivery_status !== 'pending' && (
                    <span className="text-[10px] uppercase tracking-wide text-kente">✓ {l.delivery_status}</span>
                  )}
                </div>
                <div className="mt-2 flex items-baseline justify-between text-sm">
                  <span className="tnum text-ink/70">{formatMoney(l.raised, event.currency)}{l.target > 0 && <span className="text-ink/40"> of {formatMoney(l.target, event.currency)}</span>}</span>
                  {l.pct !== null && <span className="tnum text-terracotta text-xs">{l.pct}%</span>}
                </div>
                {l.pct !== null && (
                  <div className="mt-2 h-1.5 rounded-full bg-plum/10 overflow-hidden">
                    <div className="h-full rounded-full bg-champagne" style={{ width: `${l.pct}%` }} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-3xl bg-plum text-cream p-8">
        <Eyebrow className="text-champagne-light mb-3">The couple&apos;s pool</Eyebrow>
        <div className="flex items-baseline gap-3">
          <span className="font-display text-4xl tnum">{formatMoney(raised, cur)}</span>
          {goal > 0 && <span className="text-cream/55 text-sm tnum">of {formatMoney(goal, cur)}</span>}
        </div>
        {pct !== null && (
          <div className="mt-4 h-2.5 rounded-full bg-cream/15 overflow-hidden">
            <div className="h-full rounded-full bg-champagne transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        )}
        <p className="mt-3 text-cream/55 text-sm">{gifts} {gifts === 1 ? 'gift' : 'gifts'} so far · secured by Paystack</p>

        {recent.length > 0 && (
          <ul className="mt-6 space-y-3 max-h-56 overflow-auto pr-1">
            {recent.map((c, i) => (
              <li key={i} className="flex items-start gap-3 text-sm border-t border-cream/10 pt-3 first:border-0 first:pt-0">
                <Heart size={16} className="text-champagne-light mt-0.5 shrink-0" />
                <div className="flex-1">
                  <span className="text-cream">{c.name || 'Anonymous'}</span>
                  <span className="text-champagne-light tnum"> · {formatMoney(c.amount, c.currency || cur)}</span>
                  {c.message && <p className="text-cream/55 text-xs mt-0.5 leading-relaxed">“{c.message}”</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={give} noValidate className="rounded-3xl bg-cream-deep border border-plum/8 p-8 space-y-5">
        <h3 className="font-display text-plum text-2xl">Send a gift</h3>
        {selectedLine && (
          <p className="text-sm text-ink/60 -mt-2">
            Giving toward <span className="text-plum font-medium">{selectedLine.label}</span>
            <button type="button" onClick={() => setLineId(null)} className="ml-2 text-terracotta text-xs link-underline">give generally instead</button>
          </p>
        )}
        <div className="grid grid-cols-4 gap-2">
          {chips.map((m) => (
            <button key={m} type="button" onClick={() => setAmount(m)}
              className={`py-2.5 rounded-xl border text-sm tnum transition-all ${amount === m ? 'border-plum bg-plum text-cream' : 'border-plum/20 text-ink/70 hover:border-plum/50'}`}>
              {formatMoney(m, cur)}
            </button>
          ))}
        </div>
        <Field label={`Custom amount (${cur})`} type="number" min="5" inputMode="numeric"
          value={fromMinor(amount, cur)} onChange={(e) => setAmount(toMinor(e.target.value || 0, cur))} />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ama Mensah" />
          <Field label="Email (receipt)" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" inputMode="email" />
        </div>
        <Field as="textarea" rows="2" label="Message (optional)" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Wishing you a lifetime of joy…" />
        <label className="flex items-center gap-2 text-sm text-ink/60">
          <input type="checkbox" checked={form.anonymous} onChange={(e) => setForm({ ...form, anonymous: e.target.checked })} className="accent-plum w-4 h-4" />
          Give anonymously
        </label>
        {err && <p role="alert" className="text-sm text-terracotta">{err}</p>}
        <Button type="submit" variant="primary" size="md" loading={busy} className="w-full">
          <CreditCard size={18} /> {busy ? 'Starting…' : `Gift ${formatMoney(amount, cur)}`}
        </Button>
      </form>
    </div>
  )
}

function RsvpForm({ slug, onCount }) {
  const [form, setForm] = useState({ name: '', email: '', status: 'yes', party_size: 1, message: '' })
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return setErr('Please enter your name.')
    setBusy(true); setErr('')
    try {
      const res = await api.rsvp(slug, form)
      onCount?.(res.rsvp)
      setDone(true)
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Something went wrong.'); setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-3xl bg-plum text-cream p-8 text-center animate-scale-in">
        <CheckCircle size={36} className="text-champagne-light mx-auto" />
        <p className="font-display italic text-champagne-light text-lg mt-3">Medaase!</p>
        <p className="text-cream/75 mt-1">Your RSVP is in — we can&apos;t wait to celebrate with you.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-3xl bg-cream-deep border border-plum/8 p-8 space-y-5">
      <h3 className="font-display text-plum text-2xl">Will you be there?</h3>
      <div className="grid grid-cols-3 gap-2">
        {[['yes', 'Joyfully yes'], ['maybe', 'Maybe'], ['no', "Can't make it"]].map(([v, label]) => (
          <button key={v} type="button" onClick={() => setForm({ ...form, status: v })}
            className={`py-2.5 rounded-xl border text-sm transition-all ${form.status === v ? 'border-plum bg-plum text-cream' : 'border-plum/20 text-ink/70 hover:border-plum/50'}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Your name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ama Mensah" />
        <Field label="Party size" type="number" min="1" inputMode="numeric" value={form.party_size} onChange={(e) => setForm({ ...form, party_size: Math.max(1, parseInt(e.target.value) || 1) })} />
      </div>
      <Field label="Email (optional)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" inputMode="email" />
      <Field as="textarea" rows="2" label="A note for the hosts (optional)" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
      {err && <p role="alert" className="text-sm text-terracotta">{err}</p>}
      <Button type="submit" variant="gold" size="md" loading={busy} className="w-full">Send RSVP</Button>
    </form>
  )
}

export default function EventPage() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rsvpCount, setRsvpCount] = useState(null)
  const justGifted = params.get('payment') === 'success'

  const load = useCallback(async () => {
    try {
      const res = await api.event(slug)
      setData(res)
      setRsvpCount(res.rsvp)
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? 'notfound' : 'error')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { load() }, [load])

  const countdown = useCountdown(data?.event?.event_date)

  if (loading) return <div className="min-h-dvh grid place-items-center bg-plum-deep text-cream"><Spinner size={32} /></div>
  if (error === 'notfound') return (
    <div className="min-h-dvh grid place-items-center bg-plum-deep text-cream text-center px-6">
      <div>
        <p className="font-display text-4xl">This event isn&apos;t available</p>
        <Button to="/" variant="gold" size="md" className="mt-6">Go to Gather Ghana <ArrowRight size={18} /></Button>
      </div>
    </div>
  )
  if (error) return <div className="min-h-dvh grid place-items-center bg-plum-deep text-cream">Couldn&apos;t load this event.</div>

  const { event, schedule, gallery, contributions, lineItems = [] } = data

  return (
    <div className="min-h-dvh bg-cream">
      <Seo title={event.title} description={`${event.host_names || event.title} · ${fmtDate(event.event_date)} · ${event.location || 'Ghana'}`} image={event.cover_image || undefined} noindex={event.visibility !== 'public'} />

      {/* Cover */}
      <section className="relative min-h-[88vh] flex items-end overflow-hidden bg-plum-deep text-cream">
        {event.cover_image && <img src={event.cover_image} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-plum-deep via-plum-deep/80 to-plum-deep/30" />
        <Container className="relative z-10 pb-16 pt-32">
          <Eyebrow className="text-champagne-light mb-5 rise rise-1">{event.event_type || 'Celebration'}</Eyebrow>
          <h1 className="rise rise-2 font-display text-5xl sm:text-7xl leading-[0.95] text-balance">{event.host_names || event.title}</h1>
          {event.host_names && <p className="rise rise-2 font-display italic text-champagne-light text-2xl mt-3">{event.title}</p>}
          <div className="rise rise-3 mt-7 flex flex-wrap items-center gap-x-7 gap-y-3 text-cream/80">
            <span className="inline-flex items-center gap-2"><Calendar size={18} className="text-champagne-light" /> {fmtDate(event.event_date)}{event.start_time ? ` · ${event.start_time}` : ''}</span>
            {event.venue && <span className="inline-flex items-center gap-2"><MapPin size={18} className="text-champagne-light" /> {event.venue}{event.location ? `, ${event.location}` : ''}</span>}
            {rsvpCount && <span className="inline-flex items-center gap-2"><Users size={18} className="text-champagne-light" /> {rsvpCount.guests} attending</span>}
          </div>
          {countdown && !countdown.past && (
            <p className="rise rise-3 mt-4 text-champagne-light tnum">In {countdown.days} days, {countdown.hours} hours</p>
          )}
          {countdown?.past && (
            <p className="rise rise-3 mt-4 text-champagne-light italic font-display text-lg">A beautiful day, beautifully remembered.</p>
          )}
          <div className="rise rise-4 mt-8 flex flex-wrap items-center gap-4">
            <Button href="#rsvp" variant="gold" size="lg">RSVP</Button>
            {event.contributions_enabled && <Button href="#gift" variant="ghostLight" size="lg">Send a gift</Button>}
          </div>
          <div className="rise rise-4 mt-6"><ShareRow title={event.title} /></div>
        </Container>
        <KenteBand className="h-1.5 absolute bottom-0 inset-x-0" />
      </section>

      {justGifted && (
        <div className="bg-champagne-pale text-plum text-center py-4 px-6">
          <span className="font-display italic text-terracotta">Medaase!</span> Your gift was received with love. 💛
        </div>
      )}

      {/* Story */}
      {event.story && (
        <Section tone="cream" pad="md">
          <Container className="max-w-2xl text-center">
            <p className="font-display text-plum text-2xl sm:text-3xl leading-snug text-balance">{event.story}</p>
          </Container>
        </Section>
      )}

      {/* Schedule */}
      {schedule.length > 0 && (
        <Section tone="creamDeep" pad="md">
          <Container className="max-w-3xl">
            <h2 className="font-display text-plum text-3xl sm:text-4xl text-center mb-10">Order of the day</h2>
            <ol className="space-y-5">
              {schedule.map((s, i) => (
                <Reveal as="li" key={i} delay={i * 60} className="flex gap-5 rounded-2xl bg-cream p-5 border border-plum/5">
                  <span className="font-display text-terracotta text-lg tnum w-24 shrink-0">{s.time || '—'}</span>
                  <div>
                    <p className="font-display text-plum text-lg">{s.title}</p>
                    {s.description && <p className="text-ink/60 text-sm mt-0.5">{s.description}</p>}
                  </div>
                </Reveal>
              ))}
            </ol>
          </Container>
        </Section>
      )}

      {/* Gallery */}
      {gallery.length > 0 && (
        <Section tone="cream" pad="md">
          <Container>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {gallery.map((g, i) => (
                <Img key={i} src={g.url} alt={g.caption || event.title} ratio="1 / 1" className="rounded-2xl" />
              ))}
            </div>
          </Container>
        </Section>
      )}

      {/* Livestream */}
      {event.livestream_url && (
        <Section tone="plumDeep" pad="md">
          <Container className="max-w-3xl text-center">
            <h2 className="font-display text-3xl mb-6">Can&apos;t be there in person?</h2>
            <Button href={event.livestream_url} variant="gold" size="lg">Watch the livestream <ArrowRight size={18} /></Button>
          </Container>
        </Section>
      )}

      {/* Contribution pool */}
      {event.contributions_enabled && (
        <Section tone="cream" id="gift">
          <Container>
            <div className="max-w-2xl mx-auto text-center mb-12">
              <Eyebrow className="text-terracotta mb-3">A gift from the heart</Eyebrow>
              <h2 className="font-display text-plum text-3xl sm:text-4xl text-balance">Help {event.host_names || 'the hosts'} celebrate</h2>
              <p className="mt-4 text-ink/65">Contribute to the celebration directly — securely, by Mobile Money or card.</p>
            </div>
            <ContributionPool slug={slug} event={event} data={contributions} lineItems={lineItems} />
          </Container>
        </Section>
      )}

      {/* RSVP */}
      {event.rsvp_enabled && (
        <Section tone="creamDeep" id="rsvp">
          <Container className="max-w-2xl">
            <RsvpForm slug={slug} onCount={setRsvpCount} />
          </Container>
        </Section>
      )}

      {/* Viral footer — every guest is invited to create their own */}
      <section className="bg-plum-deep text-cream py-16 text-center relative">
        <KenteBand className="h-1 absolute top-0 inset-x-0" />
        <Container>
          <p className="text-cream/60 text-sm">Planning a celebration of your own?</p>
          <Link to="/" className="font-display text-2xl sm:text-3xl mt-2 inline-block hover:text-champagne-light transition-colors">
            Create your event with <span className="italic text-champagne-light">Gather Ghana</span>
          </Link>
          <div className="mt-6"><Button to="/book" variant="gold" size="md">Start planning <ArrowRight size={18} /></Button></div>
        </Container>
      </section>
    </div>
  )
}
