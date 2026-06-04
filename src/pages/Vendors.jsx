import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Img from '../components/ui/Img.jsx'
import Reveal from '../components/ui/Reveal.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { Star, CheckCircle, Spinner, ArrowRight } from '../lib/icons.jsx'
import { api } from '../lib/api.js'
import { useCurrency } from '../lib/CurrencyContext.jsx'
import { img } from '../lib/images.js'

const CATEGORIES = [
  { key: '', label: 'All' },
  { key: 'venue', label: 'Venues' },
  { key: 'catering', label: 'Catering' },
  { key: 'decor', label: 'Décor & Florals' },
  { key: 'photography', label: 'Photography' },
  { key: 'music', label: 'Music & DJs' },
  { key: 'makeup', label: 'Makeup' },
]

export function Stars({ value, size = 14 }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-champagne" aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={size} className={i < Math.round(value) ? 'fill-champagne' : 'opacity-30'} />
      ))}
    </span>
  )
}

export default function Vendors() {
  const { fmtGhs } = useCurrency()
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.vendors({ category: cat, q })
      .then((r) => { if (!cancelled) setVendors(r.vendors) })
      .catch(() => { if (!cancelled) setVendors([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [cat, q])

  return (
    <>
      <Seo title="Vendors" description="A curated, verified marketplace of Ghana's best event vendors — venues, caterers, décor, photography, music, and makeup." />
      <PageHeader
        eyebrow="Marketplace"
        title={<>Ghana&apos;s finest, <span className="italic text-champagne-light">verified</span></>}
        subtitle="A curated directory of trusted vendors. Every verified badge is a vendor we'd put our name behind."
        image={img.corporate.src}
      />

      <Section tone="cream">
        <Container>
          <div className="flex flex-col sm:flex-row gap-4 mb-10">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button key={c.key} onClick={() => setCat(c.key)}
                  className={`px-4 py-2 rounded-full text-sm border transition-all ${cat === c.key ? 'border-plum bg-plum text-cream' : 'border-plum/20 text-ink/70 hover:border-plum/50'}`}>
                  {c.label}
                </button>
              ))}
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendors…"
              className="sm:ml-auto h-11 px-4 rounded-full border border-plum/20 bg-white focus:outline-none focus:border-plum text-sm w-full sm:w-64" />
          </div>

          {loading ? (
            <div className="grid place-items-center py-20 text-plum"><Spinner size={32} /></div>
          ) : vendors.length === 0 ? (
            <p className="text-center text-ink/55 py-16">No vendors match — try another category.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {vendors.map((v, i) => (
                <Reveal as={Link} key={v.slug} to={`/vendors/${v.slug}`} delay={(i % 3) * 80}
                  className="group rounded-3xl overflow-hidden bg-cream-deep border border-plum/8 shadow-sm hover:shadow-lg transition-shadow">
                  <Img src={v.image} alt={v.name} ratio="4 / 3" imgClassName="group-hover:scale-105 transition-transform duration-700 ease-out-expo" />
                  <div className="p-6">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-plum text-xl">{v.name}</h3>
                      {v.verified === 1 && <CheckCircle size={16} className="text-kente" title="Verified" />}
                    </div>
                    <p className="text-ink/55 text-sm mt-0.5 capitalize">{v.category} · {v.location}</p>
                    <p className="text-ink/70 text-sm mt-2 leading-relaxed">{v.tagline}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-sm text-ink/60"><Stars value={v.rating} /> {v.rating.toFixed(1)}</span>
                      <span className="text-sm text-plum tnum">from {fmtGhs(v.price_from / 100)}</span>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          )}
        </Container>
      </Section>
    </>
  )
}
