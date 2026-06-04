import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import Field from '../components/ui/Field.jsx'
import Img from '../components/ui/Img.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { Stars } from './Vendors.jsx'
import { CheckCircle, Spinner, WhatsApp, ArrowLeft, ArrowRight } from '../lib/icons.jsx'
import { api, ApiError } from '../lib/api.js'
import { useCurrency } from '../lib/CurrencyContext.jsx'
import { useAuth } from '../lib/AuthContext.jsx'

export default function VendorProfile() {
  const { slug } = useParams()
  const { fmtGhs } = useCurrency()
  const { client } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [review, setReview] = useState({ rating: 5, body: '' })
  const [posting, setPosting] = useState(false)
  const [posted, setPosted] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api.vendor(slug)
      setData(r)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { load() }, [load])

  const submitReview = async (e) => {
    e.preventDefault()
    setPosting(true)
    try {
      await api.reviewVendor(slug, { rating: review.rating, body: review.body, author: client?.name })
      setPosted(true)
      await load()
    } catch { /* surfaced below */ } finally { setPosting(false) }
  }

  if (loading) return <div className="min-h-dvh grid place-items-center text-plum"><Spinner size={32} /></div>
  if (notFound) return (
    <Section tone="cream" className="min-h-dvh grid place-items-center">
      <Container className="text-center">
        <p className="font-display text-plum text-3xl">Vendor not found</p>
        <Button to="/vendors" variant="outline" size="md" className="mt-6"><ArrowLeft size={18} /> Back to vendors</Button>
      </Container>
    </Section>
  )

  const { vendor, reviews } = data

  return (
    <>
      <Seo title={vendor.name} description={vendor.tagline} image={vendor.image} />
      <section className="relative bg-plum-deep text-cream pt-32 pb-0 overflow-hidden">
        <Container className="relative z-10">
          <Link to="/vendors" className="inline-flex items-center gap-2 text-cream/70 hover:text-cream text-sm mb-6"><ArrowLeft size={16} /> All vendors</Link>
        </Container>
        <Container className="grid md:grid-cols-2 gap-10 items-end relative z-10 pb-12">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-4xl sm:text-5xl">{vendor.name}</h1>
              {vendor.verified === 1 && <CheckCircle size={22} className="text-champagne-light" />}
            </div>
            <p className="text-cream/70 mt-2 capitalize">{vendor.category} · {vendor.location}</p>
            <div className="mt-4 flex items-center gap-3">
              <Stars value={vendor.rating} size={16} />
              <span className="text-cream/70 text-sm">{vendor.rating.toFixed(1)} · {vendor.reviews_count} reviews</span>
            </div>
            <p className="mt-5 text-champagne-light font-display text-2xl tnum">from {fmtGhs(vendor.price_from / 100)}</p>
          </div>
          <Img src={vendor.image} alt={vendor.name} ratio="4 / 3" className="rounded-t-3xl" />
        </Container>
      </section>

      <Section tone="cream">
        <Container className="grid lg:grid-cols-3 gap-10 items-start">
          <div className="lg:col-span-2 space-y-8">
            <p className="text-ink/75 text-lg leading-relaxed max-w-prose">{vendor.about}</p>

            <div>
              <h2 className="font-display text-plum text-2xl mb-5">Reviews</h2>
              {reviews.length === 0 ? (
                <p className="text-ink/55 text-sm">No reviews yet — be the first.</p>
              ) : (
                <ul className="space-y-4">
                  {reviews.map((r, i) => (
                    <li key={i} className="rounded-2xl bg-cream-deep border border-plum/8 p-5">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-plum">{r.author}</span>
                        <Stars value={r.rating} />
                      </div>
                      {r.body && <p className="text-ink/70 text-sm mt-2 leading-relaxed">{r.body}</p>}
                    </li>
                  ))}
                </ul>
              )}

              {/* Leave a review (signed-in clients) */}
              {client ? (
                posted ? (
                  <p className="mt-6 text-kente text-sm inline-flex items-center gap-2"><CheckCircle size={16} /> Thanks — your review is live.</p>
                ) : (
                  <form onSubmit={submitReview} className="mt-6 rounded-2xl bg-cream-deep border border-plum/8 p-6 space-y-4">
                    <p className="font-display text-plum text-lg">Leave a review</p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" onClick={() => setReview({ ...review, rating: n })}
                          className={`w-9 h-9 rounded-full border ${review.rating >= n ? 'bg-champagne border-champagne text-plum-deep' : 'border-plum/20 text-ink/40'}`}>★</button>
                      ))}
                    </div>
                    <Field as="textarea" rows="2" label="Your experience" value={review.body} onChange={(e) => setReview({ ...review, body: e.target.value })} />
                    <Button type="submit" variant="primary" size="sm" loading={posting}>Post review</Button>
                  </form>
                )
              ) : (
                <p className="mt-6 text-sm text-ink/55">
                  <Link to="/login" className="text-terracotta link-underline">Sign in</Link> to leave a review.
                </p>
              )}
            </div>
          </div>

          {/* Contact / request */}
          <div className="rounded-3xl bg-plum text-cream p-7 lg:sticky lg:top-28">
            <h2 className="font-display text-2xl mb-2">Like what you see?</h2>
            <p className="text-cream/65 text-sm leading-relaxed">Add {vendor.name} to your plan, or reach out directly.</p>
            <Button to="/book" variant="gold" size="md" className="w-full mt-6">Request this vendor <ArrowRight size={18} /></Button>
            {vendor.whatsapp && (
              <a href={vendor.whatsapp} className="mt-3 flex items-center justify-center gap-2 rounded-full border border-cream/25 py-3 text-sm hover:bg-cream/10 transition-colors">
                <WhatsApp size={18} /> Message on WhatsApp
              </a>
            )}
          </div>
        </Container>
      </Section>
    </>
  )
}
