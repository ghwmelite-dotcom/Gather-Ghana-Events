import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import Field from '../components/ui/Field.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { Lock, Mail, CheckCircle, ArrowRight } from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'
import { isEmail } from '../lib/validate.js'
import { useAuth } from '../lib/AuthContext.jsx'

export default function Login() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { setClient, client } = useAuth()
  const token = params.get('token')

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState(token ? 'verifying' : 'idle')
  // idle | sending | sent | verifying | error
  const [devLink, setDevLink] = useState('')

  // Already signed in → go straight to the portal.
  useEffect(() => {
    if (client) navigate('/portal', { replace: true })
  }, [client, navigate])

  // Magic-link arrival: verify the token, then enter the portal.
  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.verifyMagicLink(token)
        if (cancelled) return
        setClient(res.client)
        navigate('/portal', { replace: true })
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setError(
          err instanceof ApiError ? err.message : 'This link could not be verified.'
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, setClient, navigate])

  const submit = async (e) => {
    e.preventDefault()
    if (!isEmail(email)) {
      setError('Enter a valid email address.')
      return
    }
    setStatus('sending')
    setError('')
    try {
      const res = await api.requestMagicLink(email)
      setStatus('sent')
      if (res?.devLink) setDevLink(res.devLink)
    } catch (err) {
      setStatus('idle')
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <>
      <Seo title="Client Portal Sign In" noindex />
      <PageHeader
        eyebrow="Client Portal"
        title={<>Welcome <span className="italic text-champagne-light">back</span></>}
        subtitle="Sign in with your email to view your event timeline, payments, and details."
      />

      <Section tone="cream">
        <Container className="max-w-md">
          {status === 'verifying' ? (
            <div className="rounded-3xl bg-cream-deep border border-plum/8 p-10 text-center">
              <Lock size={32} className="text-terracotta mx-auto" />
              <p className="mt-4 font-display text-plum text-2xl">Signing you in…</p>
              <p className="mt-2 text-ink/60 text-sm">Verifying your secure link.</p>
            </div>
          ) : status === 'sent' ? (
            <div className="rounded-3xl bg-plum text-cream p-10 animate-scale-in">
              <CheckCircle size={36} className="text-champagne-light" />
              <h2 className="font-display text-2xl mt-4 mb-2">Check your inbox</h2>
              <p className="text-cream/70 leading-relaxed text-sm">
                If <span className="text-cream">{email}</span> matches a client account,
                we&apos;ve sent a secure sign-in link. It expires in 30 minutes.
              </p>
              {devLink && (
                <div className="mt-6 rounded-xl bg-cream/10 p-4">
                  <p className="text-xs text-champagne-light mb-2">
                    Dev mode — email isn&apos;t configured, so use this link:
                  </p>
                  <a href={devLink} className="text-cream text-sm break-all link-underline">
                    {devLink}
                  </a>
                </div>
              )}
              <button
                onClick={() => { setStatus('idle'); setDevLink('') }}
                className="mt-6 text-champagne-light text-sm link-underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="rounded-3xl bg-cream-deep border border-plum/8 p-8 sm:p-10">
              <div className="flex items-center gap-3 mb-6">
                <span className="grid place-items-center w-11 h-11 rounded-full bg-plum text-cream">
                  <Mail size={20} />
                </span>
                <div>
                  <p className="font-display text-plum text-xl">Sign in</p>
                  <p className="text-ink/55 text-sm">We&apos;ll email you a secure link.</p>
                </div>
              </div>

              <Field
                label="Email address"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={status === 'error' || error ? error : undefined}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
              />

              <Button type="submit" variant="primary" size="md" loading={status === 'sending'} className="w-full mt-6">
                {status === 'sending' ? 'Sending link…' : 'Email me a sign-in link'}
              </Button>

              <p className="mt-5 flex items-center justify-center gap-2 text-xs text-ink/45">
                <Lock size={14} /> Passwordless &amp; secure — no password to remember.
              </p>
            </form>
          )}

          {status === 'error' && !token && (
            <p role="alert" className="mt-4 text-sm text-terracotta text-center">{error}</p>
          )}
          {status === 'error' && token && (
            <div className="mt-6 text-center">
              <p role="alert" className="text-sm text-terracotta">{error}</p>
              <Button to="/login" variant="outline" size="sm" className="mt-4">
                Request a new link <ArrowRight size={16} />
              </Button>
            </div>
          )}

          <p className="mt-8 text-center text-ink/55 text-sm">
            Not a client yet?{' '}
            <Link to="/book" className="text-terracotta link-underline">Start planning</Link>
          </p>
        </Container>
      </Section>
    </>
  )
}
