import { useState } from 'react'
import Seo from '../components/Seo.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import Field from '../components/ui/Field.jsx'
import Reveal from '../components/ui/Reveal.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { CheckCircle, WhatsApp, Mail, MapPin, TikTok, Clock } from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'
import { isEmail, required, validate } from '../lib/validate.js'

const WHATSAPP_URL = 'https://wa.me/233000000000'
const EMAIL = 'hello@gatherghana.events'
const TIKTOK_URL = 'https://www.tiktok.com/@gatherghana_events'

const methods = [
  { Icon: WhatsApp, label: 'WhatsApp', value: 'Chat with us', href: WHATSAPP_URL },
  { Icon: Mail, label: 'Email', value: EMAIL, href: `mailto:${EMAIL}` },
  { Icon: TikTok, label: 'TikTok', value: '@gatherghana_events', href: TIKTOK_URL },
  { Icon: MapPin, label: 'Studio', value: 'Accra, Ghana', href: null },
]

const rules = {
  name: [{ test: required, message: 'Please tell us your name.' }],
  email: [{ test: (v) => isEmail(v), message: 'Enter a valid email address.' }],
  message: [{ test: required, message: 'Add a short message so we can help.' }],
}

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle') // idle | sending | sent
  const [serverError, setServerError] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const blur = (k) => () => {
    const e = validate(form, { [k]: rules[k] })
    setErrors((prev) => ({ ...prev, ...e, ...(e[k] ? {} : { [k]: undefined }) }))
  }

  const submit = async (e) => {
    e.preventDefault()
    const found = validate(form, rules)
    setErrors(found)
    if (Object.keys(found).length) {
      document.getElementById(`field-${Object.keys(found)[0]}`)?.focus()
      return
    }
    setStatus('sending')
    setServerError('')
    try {
      await api.sendMessage(form)
      setStatus('sent')
    } catch (err) {
      setStatus('idle')
      setServerError(
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'
      )
    }
  }

  return (
    <>
      <Seo
        title="Contact"
        description="Get in touch with Gather Ghana Events in Accra — WhatsApp, email, or send us a message about your upcoming event."
      />
      <PageHeader
        eyebrow="Contact"
        title={<>Let&apos;s start a <span className="italic text-champagne-light">conversation</span></>}
        subtitle="Have a question or an event in mind? Reach us however suits you best — we reply within a day."
      />

      <Section tone="cream">
        <Container className="grid lg:grid-cols-12 gap-12 items-start">
          {/* Contact methods */}
          <div className="lg:col-span-5">
            <div className="grid sm:grid-cols-2 gap-4">
              {methods.map((m) => {
                const Inner = (
                  <>
                    <m.Icon size={22} className="text-terracotta" />
                    <p className="mt-3 text-xs uppercase tracking-widest text-ink/45">{m.label}</p>
                    <p className="font-display text-plum text-lg mt-0.5">{m.value}</p>
                  </>
                )
                return m.href ? (
                  <a
                    key={m.label}
                    href={m.href}
                    className="rounded-2xl bg-cream-deep border border-plum/8 p-6 hover:shadow-md hover:-translate-y-0.5 transition-all"
                  >
                    {Inner}
                  </a>
                ) : (
                  <div key={m.label} className="rounded-2xl bg-cream-deep border border-plum/8 p-6">
                    {Inner}
                  </div>
                )
              })}
            </div>
            <div className="mt-6 rounded-2xl bg-plum text-cream p-6 flex items-start gap-4">
              <Clock size={22} className="text-champagne-light shrink-0 mt-0.5" />
              <div>
                <p className="font-display text-lg">Response time</p>
                <p className="text-cream/65 text-sm mt-1 leading-relaxed">
                  We reply to every inquiry within 24 hours, Monday to Saturday.
                </p>
              </div>
            </div>
          </div>

          {/* Message form */}
          <div className="lg:col-span-7">
            {status === 'sent' ? (
              <Reveal className="rounded-3xl bg-plum text-cream p-10">
                <CheckCircle size={40} className="text-champagne-light" />
                <span className="font-display italic text-champagne-light text-xl block mt-4">Medaase!</span>
                <h2 className="font-display text-3xl mt-1 mb-3">Message received</h2>
                <p className="text-cream/70 leading-relaxed">
                  Thank you, {form.name || 'friend'}. We&apos;ve got your note and will be in
                  touch within a day. For anything urgent, message us on WhatsApp.
                </p>
                <Button href={WHATSAPP_URL} variant="gold" size="md" className="mt-7">
                  <WhatsApp size={18} /> Message on WhatsApp
                </Button>
              </Reveal>
            ) : (
              <form onSubmit={submit} noValidate className="rounded-3xl bg-cream-deep border border-plum/8 p-8 sm:p-10 space-y-6">
                <Field
                  id="field-name"
                  label="Your name"
                  required
                  value={form.name}
                  onChange={set('name')}
                  onBlur={blur('name')}
                  error={errors.name}
                  placeholder="e.g. Ama Mensah"
                  autoComplete="name"
                />
                <Field
                  id="field-email"
                  label="Email"
                  type="email"
                  required
                  value={form.email}
                  onChange={set('email')}
                  onBlur={blur('email')}
                  error={errors.email}
                  placeholder="you@example.com"
                  autoComplete="email"
                  inputMode="email"
                />
                <Field
                  id="field-message"
                  as="textarea"
                  rows="5"
                  label="Message"
                  required
                  value={form.message}
                  onChange={set('message')}
                  onBlur={blur('message')}
                  error={errors.message}
                  placeholder="Tell us a little about what you have in mind…"
                />
                {serverError && (
                  <p role="alert" className="text-sm text-terracotta">{serverError}</p>
                )}
                <Button type="submit" variant="primary" size="md" loading={status === 'sending'} className="w-full">
                  {status === 'sending' ? 'Sending…' : 'Send message'}
                </Button>
              </form>
            )}
          </div>
        </Container>
      </Section>
    </>
  )
}
