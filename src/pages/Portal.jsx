import { useState, useEffect, useCallback } from 'react'
import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import {
  Calendar, Users, CreditCard, CheckCircle, Clock, LogOut, WhatsApp, ArrowRight, Spinner, Lock,
} from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'
import { fmtGhs } from '../lib/content.js'
import { formatMoney } from '../lib/money.js'
import { useAuth } from '../lib/AuthContext.jsx'

const escrowChip = {
  funded: { label: 'Held in escrow', cls: 'bg-champagne/20 text-terracotta' },
  release_requested: { label: 'Release requested', cls: 'bg-champagne/20 text-terracotta' },
  released: { label: 'Released', cls: 'bg-kente/15 text-kente' },
  disputed: { label: 'Under review', cls: 'bg-plum/10 text-ink/50' },
}

const proposalChip = {
  sent: { label: 'Awaiting your decision', cls: 'bg-champagne/20 text-terracotta' },
  accepted: { label: 'Accepted', cls: 'bg-kente/15 text-kente' },
  declined: { label: 'Declined', cls: 'bg-plum/10 text-ink/50' },
  draft: { label: 'Draft', cls: 'bg-plum/5 text-ink/40' },
}

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

function Timeline({ items, onAction, acting }) {
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
        const hasEscrow = t.amount > 0 && t.escrow_status && t.escrow_status !== 'none'
        const chip = escrowChip[t.escrow_status]
        const releasable = t.escrow_status === 'funded' || t.escrow_status === 'release_requested'
        return (
          <li key={t.id} className="relative flex gap-5 pb-8">
            {!last && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-plum/15" aria-hidden="true" />}
            <span className={`relative z-10 grid place-items-center w-8 h-8 rounded-full border-2 shrink-0 ${s.ring}`}>
              {t.status === 'done' ? <CheckCircle size={16} /> : t.status === 'in_progress' ? <Clock size={16} /> : <span className="w-2 h-2 rounded-full bg-current" />}
            </span>
            <div className="pt-0.5 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="font-display text-plum text-lg">{t.title}</h3>
                <span className="text-[11px] uppercase tracking-wider text-ink/45">{fmtDate(t.due_date)}</span>
              </div>
              {t.description && <p className="text-ink/65 text-sm mt-1 leading-relaxed">{t.description}</p>}

              {hasEscrow && (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-cream border border-plum/8 p-3">
                  <Lock size={16} className="text-terracotta shrink-0" />
                  <span className="font-display text-plum tnum">{formatMoney(t.amount, t.currency)}</span>
                  {chip && <span className={`text-[11px] px-2 py-0.5 rounded-full ${chip.cls}`}>{chip.label}</span>}
                  {releasable && (
                    <button
                      onClick={() => onAction(t.id, 'approve')}
                      disabled={acting === t.id}
                      className="ml-auto inline-flex items-center gap-1.5 text-sm rounded-full bg-plum text-cream px-4 py-1.5 hover:bg-plum-soft transition-colors disabled:opacity-50"
                    >
                      {acting === t.id ? <Spinner size={14} /> : <CheckCircle size={14} />} Approve &amp; release
                    </button>
                  )}
                </div>
              )}
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
  const [acting, setActing] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await api.portal()
      setData(res)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your portal.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const actOnMilestone = async (milestoneId, action) => {
    setActing(milestoneId)
    setError('')
    try {
      await api.milestoneAction(milestoneId, action)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the milestone.')
    } finally {
      setActing(null)
    }
  }

  const actOnProposal = async (proposalId, action) => {
    setActing(proposalId)
    setError('')
    try {
      await api.proposalAction(proposalId, action)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the proposal.')
    } finally {
      setActing(null)
    }
  }

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
          <div className="flex items-center gap-3">
            {client?.isOrganizer && (
              <Button to="/org" variant="gold" size="sm">
                Organizer dashboard <ArrowRight size={16} />
              </Button>
            )}
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 text-sm text-cream/70 hover:text-cream border border-cream/20 rounded-full px-5 py-2.5 transition-colors"
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
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
                  <Timeline items={data.timeline} onAction={actOnMilestone} acting={acting} />
                </div>

                {data.proposals?.length > 0 && (
                  <div className="rounded-3xl bg-cream-deep border border-plum/8 p-8">
                    <h2 className="font-display text-plum text-2xl mb-1">Proposals</h2>
                    <p className="text-ink/55 text-sm mb-6">Quotes from your planner. Accept one to move forward.</p>
                    <ul className="space-y-4">
                      {data.proposals.map((p) => {
                        const chip = proposalChip[p.status] || proposalChip.draft
                        const pending = p.status === 'sent'
                        return (
                          <li key={p.id} className="rounded-2xl border border-plum/10 p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <h3 className="font-display text-plum text-lg">{p.title}</h3>
                                <span className={`mt-1 inline-block text-[11px] px-2 py-0.5 rounded-full ${chip.cls}`}>{chip.label}</span>
                              </div>
                              <span className="font-display text-plum text-xl tnum">{formatMoney(p.amount, p.currency)}</span>
                            </div>
                            {p.body && <p className="text-ink/65 text-sm mt-3 leading-relaxed whitespace-pre-line">{p.body}</p>}
                            {pending && (
                              <div className="mt-4 flex flex-wrap gap-3">
                                <button
                                  onClick={() => actOnProposal(p.id, 'accept')}
                                  disabled={acting === p.id}
                                  className="inline-flex items-center gap-1.5 text-sm rounded-full bg-plum text-cream px-5 py-2 hover:bg-plum-soft transition-colors disabled:opacity-50"
                                >
                                  {acting === p.id ? <Spinner size={14} /> : <CheckCircle size={14} />} Accept
                                </button>
                                <button
                                  onClick={() => actOnProposal(p.id, 'decline')}
                                  disabled={acting === p.id}
                                  className="text-sm rounded-full border border-plum/20 text-plum px-5 py-2 hover:bg-plum/5 transition-colors disabled:opacity-50"
                                >
                                  Decline
                                </button>
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
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

                  {summary.escrow && (summary.escrow.held > 0 || summary.escrow.released > 0) && (
                    <div className="mt-5 rounded-xl bg-cream/10 p-4">
                      <p className="flex items-center gap-2 text-champagne-light text-sm font-medium">
                        <Lock size={15} /> Gather Guarantee
                      </p>
                      <div className="mt-2 flex justify-between text-sm">
                        <span className="text-cream/65">Held in escrow</span>
                        <span className="tnum">{formatMoney(summary.escrow.held, 'GHS')}</span>
                      </div>
                      <div className="mt-1 flex justify-between text-sm">
                        <span className="text-cream/65">Released</span>
                        <span className="tnum text-champagne-light">{formatMoney(summary.escrow.released, 'GHS')}</span>
                      </div>
                      <p className="mt-2 text-xs text-cream/45">
                        Funds are protected and released only when you approve each milestone.
                      </p>
                    </div>
                  )}

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
                <Button to="/guide#clients" variant="outline" size="sm" className="w-full">Need help? Read the guide</Button>
              </div>
            </div>
          )}
        </Container>
      </Section>
    </>
  )
}
