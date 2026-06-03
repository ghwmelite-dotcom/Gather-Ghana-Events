import { useState, useEffect } from 'react'
import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import {
  Calendar, Users, CreditCard, CheckCircle, Clock, LogOut, WhatsApp, ArrowRight, Spinner,
} from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'
import { fmtGhs } from '../lib/content.js'
import { useAuth } from '../lib/AuthContext.jsx'

const WHATSAPP_URL = 'https://wa.me/233000000000'

const statusStyles = {
  done: { ring: 'bg-champagne border-champagne text-plum-deep', label: 'Done' },
  in_progress: { ring: 'bg-plum border-plum text-cream', label: 'In progress' },
  upcoming: { ring: 'bg-cream border-plum/25 text-plum/40', label: 'Upcoming' },
}

function fmtDate(d) {
  if (!d) return '—'
  const parsed = new Date(d)
  if (isNaN(parsed)) return d
  return parsed.toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })
}

function Timeline({ items }) {
  if (!items.length) {
    return (
      <p className="text-ink/55 text-sm">
        Your planning timeline will appear here once your event is booked.
      </p>
    )
  }
  return (
    <ol className="relative">
      {items.map((t, i) => {
        const s = statusStyles[t.status] || statusStyles.upcoming
        const last = i === items.length - 1
        return (
          <li key={t.id} className="relative flex gap-5 pb-8">
            {!last && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-plum/15" aria-hidden="true" />}
            <span className={`relative z-10 grid place-items-center w-8 h-8 rounded-full border-2 shrink-0 ${s.ring}`}>
              {t.status === 'done' ? <CheckCircle size={16} /> : t.status === 'in_progress' ? <Clock size={16} /> : <span className="w-2 h-2 rounded-full bg-current" />}
            </span>
            <div className="pt-0.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="font-display text-plum text-lg">{t.title}</h3>
                <span className="text-[11px] uppercase tracking-wider text-ink/45">{fmtDate(t.due_date)}</span>
              </div>
              {t.description && <p className="text-ink/65 text-sm mt-1 leading-relaxed">{t.description}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export default function Portal() {
  const { client, logout } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.portal()
        if (!cancelled) setData(res)
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load your portal.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const payBalance = async () => {
    setPaying(true)
    setError('')
    try {
      const res = await api.initializePayment({ purpose: 'balance' })
      if (res?.authorization_url) {
        window.location.href = res.authorization_url
        return
      }
      setError('Could not start the payment. Please try again.')
      setPaying(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start the payment.')
      setPaying(false)
    }
  }

  const primary = data?.primary
  const summary = data?.summary || { estimate: 0, paid: 0, balance: 0 }

  return (
    <>
      <Seo title="Client Portal" noindex />

      {/* Portal header */}
      <section className="bg-plum-deep text-cream pt-32 pb-14">
        <Container className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-champagne-light text-sm tracking-[0.3em] uppercase mb-3">Client Portal</p>
            <h1 className="font-display text-4xl sm:text-5xl">
              Hello, {client?.name?.split(' ')[0] || 'there'}.
            </h1>
          </div>
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 text-sm text-cream/70 hover:text-cream border border-cream/20 rounded-full px-5 py-2.5 transition-colors"
          >
            <LogOut size={16} /> Sign out
          </button>
        </Container>
      </section>

      <Section tone="cream" pad="md">
        <Container>
          {loading ? (
            <div className="grid place-items-center py-20 text-plum"><Spinner size={32} /></div>
          ) : error && !data ? (
            <div className="rounded-2xl bg-cream-deep border border-terracotta/30 p-8 text-center">
              <p className="text-terracotta">{error}</p>
              <Button to="/contact" variant="outline" size="sm" className="mt-4">Contact us</Button>
            </div>
          ) : !primary ? (
            <div className="rounded-3xl bg-cream-deep border border-plum/8 p-10 text-center max-w-xl mx-auto">
              <Calendar size={36} className="text-terracotta mx-auto" />
              <h2 className="font-display text-plum text-2xl mt-4">No events yet</h2>
              <p className="text-ink/60 mt-2 leading-relaxed">
                Once you start planning with us, your event timeline and payments will appear here.
              </p>
              <Button to="/book" variant="primary" size="md" className="mt-6">
                Start planning <ArrowRight size={18} />
              </Button>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6 items-start">
              {/* Event + timeline */}
              <div className="lg:col-span-2 space-y-6">
                <div className="rounded-3xl bg-cream-deep border border-plum/8 p-8">
                  <div className="flex items-center justify-between gap-4 mb-6">
                    <h2 className="font-display text-plum text-2xl">Your {primary.event_type.toLowerCase()}</h2>
                    <span className="text-xs uppercase tracking-wider px-3 py-1 rounded-full bg-plum text-cream">
                      {primary.status}
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div className="flex items-center gap-3">
                      <Calendar size={20} className="text-terracotta" />
                      <div>
                        <p className="text-xs uppercase tracking-wider text-ink/45">Date</p>
                        <p className="font-display text-plum text-lg">{fmtDate(primary.event_date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Users size={20} className="text-terracotta" />
                      <div>
                        <p className="text-xs uppercase tracking-wider text-ink/45">Guests</p>
                        <p className="font-display text-plum text-lg tnum">{primary.guests || '—'}</p>
                      </div>
                    </div>
                  </div>
                  {primary.notes && (
                    <p className="mt-6 pt-5 border-t border-plum/10 text-ink/65 text-sm leading-relaxed">
                      <span className="text-ink/45">Your brief: </span>{primary.notes}
                    </p>
                  )}
                </div>

                <div className="rounded-3xl bg-cream-deep border border-plum/8 p-8">
                  <h2 className="font-display text-plum text-2xl mb-6">Planning timeline</h2>
                  <Timeline items={data.timeline} />
                </div>
              </div>

              {/* Payments */}
              <div className="space-y-6">
                <div className="rounded-3xl bg-plum text-cream p-8 lg:sticky lg:top-28">
                  <h2 className="font-display text-2xl mb-6">Payments</h2>
                  <dl className="space-y-4">
                    <div className="flex justify-between items-baseline">
                      <dt className="text-cream/65 text-sm">Total estimate</dt>
                      <dd className="font-display text-2xl tnum">{fmtGhs(summary.estimate)}</dd>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <dt className="text-cream/65 text-sm">Paid to date</dt>
                      <dd className="text-champagne-light tnum">{fmtGhs(summary.paid)}</dd>
                    </div>
                    <div className="flex justify-between items-baseline pt-4 border-t border-cream/15">
                      <dt className="text-cream/80 text-sm">Balance</dt>
                      <dd className="font-display text-2xl text-champagne-light tnum">{fmtGhs(summary.balance)}</dd>
                    </div>
                  </dl>

                  {summary.balance > 0 ? (
                    <Button onClick={payBalance} variant="gold" size="md" loading={paying} className="w-full mt-7">
                      <CreditCard size={18} /> {paying ? 'Starting…' : 'Pay balance'}
                    </Button>
                  ) : (
                    <p className="mt-7 flex items-center gap-2 text-champagne-light text-sm">
                      <CheckCircle size={18} /> Fully settled — thank you!
                    </p>
                  )}
                  {error && <p role="alert" className="mt-3 text-sm text-terracotta">{error}</p>}
                  <p className="mt-4 text-xs text-cream/45">Secured by Paystack · Mobile Money &amp; card.</p>
                </div>

                {data.payments?.length > 0 && (
                  <div className="rounded-3xl bg-cream-deep border border-plum/8 p-6">
                    <h3 className="font-display text-plum text-lg mb-4">Payment history</h3>
                    <ul className="space-y-3">
                      {data.payments.map((p) => (
                        <li key={p.reference} className="flex justify-between items-center text-sm">
                          <span className="text-ink/60 capitalize">{p.purpose}</span>
                          <span className="flex items-center gap-2">
                            <span className="tnum text-plum">{fmtGhs(Math.round(p.amount / 100))}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'success' ? 'bg-champagne/25 text-terracotta' : 'bg-plum/10 text-ink/50'}`}>
                              {p.status}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <a
                  href={WHATSAPP_URL}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-plum/15 py-4 text-plum hover:bg-plum/5 transition-colors text-sm"
                >
                  <WhatsApp size={18} /> Message your planner
                </a>
              </div>
            </div>
          )}
        </Container>
      </Section>
    </>
  )
}
