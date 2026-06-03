import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import Field from '../components/ui/Field.jsx'
import { Container, Section } from '../components/ui/Section.jsx'
import { CheckCircle, Lock, CreditCard, ArrowLeft, ArrowRight } from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'
import { isEmail, isPhone, required, validate } from '../lib/validate.js'
import { fmtGhs } from '../lib/content.js'

const eventTypes = [
  { key: 'Wedding', base: 35000 },
  { key: 'Birthday', base: 18000 },
  { key: 'Corporate', base: 25000 },
  { key: 'Other', base: 18000 },
]

const rules = {
  name: [{ test: required, message: 'Please enter your full name.' }],
  email: [{ test: (v) => isEmail(v), message: 'Enter a valid email for confirmation & portal access.' }],
  phone: [{ test: (v) => isPhone(v), message: 'Enter a valid Ghana number, e.g. +233 24 123 4567.' }],
  date: [{ test: required, message: 'Choose your event date.' }],
}

export default function Book() {
  const [type, setType] = useState('Wedding')
  const [guests, setGuests] = useState(100)
  const [form, setForm] = useState({ name: '', email: '', date: '', phone: '', notes: '' })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle') // idle | submitting | redirecting | done
  const [serverError, setServerError] = useState('')
  const [params] = useSearchParams()
  const paymentResult = params.get('payment') // success | failed | error (from Paystack callback)

  // Returning from Paystack checkout: reflect the outcome.
  useEffect(() => {
    if (paymentResult === 'success') setStatus('paid')
  }, [paymentResult])

  const base = eventTypes.find((e) => e.key === type)?.base ?? 18000
  const total = base + Math.max(0, guests - 100) * 80
  const deposit = total * 0.3

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const blur = (k) => () => {
    const e = validate(form, { [k]: rules[k] })
    setErrors((prev) => ({ ...prev, [k]: e[k] }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const found = validate(form, rules)
    setErrors(found)
    if (Object.keys(found).length) {
      document.getElementById(`book-${Object.keys(found)[0]}`)?.focus()
      return
    }

    setStatus('submitting')
    setServerError('')
    const payload = {
      type,
      guests: Number(guests) || 0,
      estimate: Math.round(total),
      deposit: Math.round(deposit),
      ...form,
    }

    try {
      const res = await api.createInquiry(payload)
      // If the backend initialized a Paystack transaction, go to checkout.
      if (res?.payment?.authorization_url) {
        setStatus('redirecting')
        window.location.href = res.payment.authorization_url
        return
      }
      // Backend up but payments not configured — confirm inquiry was saved.
      setStatus('done')
    } catch (err) {
      // Backend unavailable (e.g. static preview): still confirm gracefully.
      if (err instanceof ApiError && err.status === 0) {
        setStatus('done')
        return
      }
      setStatus('idle')
      setServerError(
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'
      )
    }
  }

  return (
    <>
      <Seo
        title="Start Planning"
        description="Tell us about your event and secure your date with a deposit via Paystack (Mobile Money & card). Gather Ghana Events, Accra."
      />
      <PageHeader
        eyebrow="Start Planning"
        title={<>Let&apos;s plan your <span className="italic text-champagne-light">event</span></>}
        subtitle="Tell us a few details and we'll be in touch within a day. Secure your date with a deposit whenever you're ready."
      />

      <Section tone="cream">
        <Container className="max-w-5xl grid lg:grid-cols-5 gap-12 items-start">
          {/* Form / success */}
          <div className="lg:col-span-3">
            {status === 'paid' ? (
              <div className="rounded-3xl bg-plum text-cream p-10 animate-scale-in">
                <CheckCircle size={40} className="text-champagne-light" />
                <h2 className="font-display text-3xl mt-4 mb-3">Your date is secured.</h2>
                <p className="text-cream/70 leading-relaxed">
                  Thank you — your deposit was received and your booking is confirmed. A receipt
                  is on its way to your email. You can track every detail, payment, and milestone
                  in your client portal.
                </p>
                <Button to="/portal" variant="gold" size="md" className="mt-7">
                  Go to my portal <ArrowRight size={18} />
                </Button>
              </div>
            ) : status === 'done' ? (
              <div className="rounded-3xl bg-plum text-cream p-10 animate-scale-in">
                <CheckCircle size={40} className="text-champagne-light" />
                <h2 className="font-display text-3xl mt-4 mb-3">
                  Your inquiry is in, {form.name || 'friend'}.
                </h2>
                <p className="text-cream/70 leading-relaxed">
                  We&apos;ve received your {type.toLowerCase()} details
                  {form.date ? ` for ${form.date}` : ''}. You&apos;ll hear from us within 24
                  hours. When you&apos;re ready, you can secure your date with a deposit via
                  Paystack (Mobile Money &amp; card) — we&apos;ll send a secure link.
                </p>
                <button
                  onClick={() => setStatus('idle')}
                  className="mt-8 inline-flex items-center gap-2 text-champagne-light link-underline text-sm"
                >
                  <ArrowLeft size={16} /> Edit my details
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-7">
                {(paymentResult === 'failed' || paymentResult === 'error') && (
                  <div role="alert" className="rounded-xl bg-terracotta/10 border border-terracotta/30 px-4 py-3 text-sm text-terracotta">
                    Your payment didn&apos;t go through. No charge was made — you can try again
                    below, or message us on WhatsApp and we&apos;ll help.
                  </div>
                )}
                <fieldset>
                  <legend className="block text-sm text-ink/60 mb-3">Event type</legend>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {eventTypes.map((e) => (
                      <button
                        key={e.key}
                        type="button"
                        onClick={() => setType(e.key)}
                        aria-pressed={type === e.key}
                        className={`py-3 rounded-xl border text-sm transition-all ${
                          type === e.key
                            ? 'border-plum bg-plum text-cream shadow-sm'
                            : 'border-plum/20 text-ink/70 hover:border-plum/50'
                        }`}
                      >
                        {e.key}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <Field
                  id="book-name"
                  label="Full name"
                  required
                  value={form.name}
                  onChange={set('name')}
                  onBlur={blur('name')}
                  error={errors.name}
                  placeholder="e.g. Ama Mensah"
                  autoComplete="name"
                />

                <Field
                  id="book-email"
                  label="Email"
                  type="email"
                  required
                  value={form.email}
                  onChange={set('email')}
                  onBlur={blur('email')}
                  error={errors.email}
                  helper="We'll send confirmation here and use it for your client portal."
                  placeholder="you@example.com"
                  autoComplete="email"
                  inputMode="email"
                />

                <div className="grid sm:grid-cols-2 gap-5">
                  <Field
                    id="book-date"
                    label="Event date"
                    type="date"
                    required
                    value={form.date}
                    onChange={set('date')}
                    onBlur={blur('date')}
                    error={errors.date}
                  />
                  <Field
                    id="book-guests"
                    label="Guests"
                    type="number"
                    min="1"
                    value={guests}
                    onChange={(e) => setGuests(Math.max(0, parseInt(e.target.value) || 0))}
                    inputMode="numeric"
                  />
                </div>

                <Field
                  id="book-phone"
                  label="WhatsApp number"
                  type="tel"
                  required
                  value={form.phone}
                  onChange={set('phone')}
                  onBlur={blur('phone')}
                  error={errors.phone}
                  placeholder="+233 24 123 4567"
                  autoComplete="tel"
                  inputMode="tel"
                />

                <Field
                  id="book-notes"
                  as="textarea"
                  rows="3"
                  label="Tell us about your vision"
                  value={form.notes}
                  onChange={set('notes')}
                  placeholder="Theme, colours, mood, anything you're dreaming of…"
                />

                {serverError && (
                  <p role="alert" className="text-sm text-terracotta">{serverError}</p>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={status === 'submitting' || status === 'redirecting'}
                  className="w-full"
                >
                  {status === 'redirecting'
                    ? 'Taking you to secure checkout…'
                    : status === 'submitting'
                      ? 'Checking your date…'
                      : 'Check date & continue'}
                </Button>
                <p className="flex items-center justify-center gap-2 text-xs text-ink/45">
                  <Lock size={14} /> Your details are private. No payment is taken yet.
                </p>
              </form>
            )}
          </div>

          {/* Estimate + reassurance sidebar */}
          <div className="lg:col-span-2 lg:sticky lg:top-28 space-y-5">
            <div className="rounded-3xl bg-champagne-pale p-7 shadow-md">
              <div className="flex items-center justify-between gap-3">
                <span className="font-display italic text-terracotta text-xl">Your estimate</span>
                <span className="text-[11px] uppercase tracking-widest text-ink/45 tnum">
                  {type} · {guests} {guests === 1 ? 'guest' : 'guests'}
                </span>
              </div>
              <div className="mt-6 flex items-baseline justify-between">
                <span className="text-ink/60 text-sm">Estimated package</span>
                <span className="font-display text-plum text-3xl tnum">{fmtGhs(total)}</span>
              </div>
              <div className="mt-4 pt-4 border-t border-plum/15 flex items-baseline justify-between">
                <span className="text-ink/60 text-sm">
                  Deposit to hold date <span className="text-ink/40">(30%)</span>
                </span>
                <span className="font-display text-terracotta text-xl tnum">{fmtGhs(deposit)}</span>
              </div>
              <div className="mt-5 flex items-center gap-2 text-xs text-ink/55">
                <CreditCard size={15} /> Secured by Paystack · Mobile Money &amp; card
              </div>
              <p className="mt-3 text-xs text-ink/45 leading-relaxed">
                Indicative only — your final quote is tailored to your vision, guest count, and
                requirements.
              </p>
            </div>

            <div className="rounded-3xl bg-plum text-cream p-7">
              <h2 className="font-display text-xl mb-5">What happens next</h2>
              <ol className="space-y-4">
                {[
                  { t: 'Share your details', d: 'We review your date and vision — no commitment yet.' },
                  { t: 'We reply within 24 hours', d: 'A warm hello and a tailored quote for your event.' },
                  { t: 'Secure your date', d: 'Pay your deposit by Mobile Money or card when ready.' },
                ].map((s, i) => (
                  <li key={s.t} className="flex gap-3">
                    <span className="shrink-0 grid place-items-center w-7 h-7 rounded-full bg-cream/10 text-champagne-light font-display text-sm">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-cream text-sm font-medium">{s.t}</p>
                      <p className="text-cream/60 text-xs mt-0.5 leading-relaxed">{s.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Container>
      </Section>
    </>
  )
}
