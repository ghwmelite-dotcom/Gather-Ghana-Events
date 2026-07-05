import { useState, useEffect } from 'react'
import Seo from '../components/Seo.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import Img from '../components/ui/Img.jsx'
import Reveal from '../components/ui/Reveal.jsx'
import { Section, Container, Eyebrow } from '../components/ui/Section.jsx'
import FAQ from '../components/sections/FAQ.jsx'
import { ArrowRight, Check, Spinner } from '../lib/icons.jsx'
import { api } from '../lib/api.js'
import { useCurrency } from '../lib/CurrencyContext.jsx'
import { img } from '../lib/images.js'

const process = [
  { n: '01', title: 'Discover', desc: 'We listen to your vision, date, and budget, then shape the brief together.' },
  { n: '02', title: 'Design', desc: 'A tailored concept, mood, and plan, presented for your review and refinement.' },
  { n: '03', title: 'Coordinate', desc: 'We source and manage every vendor and detail, keeping you informed throughout.' },
  { n: '04', title: 'Deliver', desc: 'On the day, we run everything seamlessly so you can simply enjoy the moment.' },
]

function Pricing({ services, fmtGhs, isForeign, currency }) {
  return (
    <Section tone="creamDeep">
      <Container>
        <div className="max-w-2xl mb-14">
          <Eyebrow className="text-terracotta mb-4">Investment</Eyebrow>
          <h2 className="font-display text-plum text-4xl sm:text-5xl leading-tight text-balance">
            Transparent starting points
          </h2>
          <p className="mt-5 text-ink/70 text-lg leading-relaxed">
            Every event is bespoke, so every quote is tailored. These indicative starting
            figures give you a sense of where each service begins.
          </p>
          {isForeign && (
            <p className="mt-3 text-sm text-terracotta">
              Shown in {currency} for convenience · events are billed in GH₵.
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          {services.map((p, i) => (
            <Reveal
              key={p.id}
              delay={i * 90}
              className={`relative rounded-3xl p-8 border flex flex-col ${
                p.featured
                  ? 'bg-plum text-cream border-plum shadow-lg md:-translate-y-3'
                  : 'bg-cream text-ink border-plum/10 shadow-sm'
              }`}
            >
              {p.featured && (
                <span className="absolute top-6 right-6 text-xs uppercase tracking-widest text-champagne-light">
                  Most popular
                </span>
              )}
              <h3 className={`font-display text-3xl ${p.featured ? 'text-cream' : 'text-plum'}`}>{p.name}</h3>
              <p className={`mt-2 text-sm ${p.featured ? 'text-cream/60' : 'text-ink/55'}`}>{p.tagline}</p>
              <div className="mt-6 flex items-baseline gap-2">
                <span className={`text-sm ${p.featured ? 'text-cream/60' : 'text-ink/50'}`}>from</span>
                <span className="font-display text-4xl tnum">{fmtGhs(p.price_from)}</span>
              </div>
              <ul className="mt-7 space-y-3 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <Check size={18} className={`mt-0.5 shrink-0 ${p.featured ? 'text-champagne-light' : 'text-terracotta'}`} />
                    <span className={p.featured ? 'text-cream/80' : 'text-ink/70'}>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Button to="/book" variant={p.featured ? 'gold' : 'outline'} size="md" className="w-full">
                  Get a tailored quote
                </Button>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  )
}

export default function Services() {
  const { fmtGhs, isForeign, currency } = useCurrency()
  const [services, setServices] = useState(null)

  useEffect(() => {
    let cancelled = false
    api.services()
      .then((r) => { if (!cancelled) setServices(r.services || []) })
      .catch(() => { if (!cancelled) setServices([]) })
    return () => { cancelled = true }
  }, [])

  return (
    <>
      <Seo
        title="Services & Pricing"
        description="Full-service event planning, styling, and coordination in Accra — weddings, celebrations, and corporate events, with transparent starting prices."
      />
      <PageHeader
        eyebrow="Services"
        title={<>How we bring your <span className="italic text-champagne-light">vision</span> to life</>}
        subtitle="Full-service planning, styling, and coordination, tailored to the scale and spirit of your event."
        image={img.corporate.src}
      />

      <Section tone="cream">
        <Container className="space-y-10">
          {services === null ? (
            <div className="grid place-items-center py-16 text-plum"><Spinner size={28} /></div>
          ) : services.map((s, i) => (
            <Reveal key={s.id} className="grid md:grid-cols-12 gap-8 lg:gap-10 items-center">
              <div className={`md:col-span-5 ${i % 2 ? 'md:order-2' : ''}`}>
                <Img src={s.image} alt={s.name} fallback="from-terracotta/30 to-plum/40" ratio="3 / 2" className="rounded-3xl shadow-md" />
              </div>
              <div className="md:col-span-7">
                <span className="font-display italic text-champagne text-2xl">0{i + 1}</span>
                <h2 className="font-display text-plum text-4xl mt-2 mb-4">{s.name}</h2>
                <p className="text-ink/70 leading-relaxed max-w-prose">{s.description}</p>
                <ul className="mt-6 grid sm:grid-cols-2 gap-x-8 gap-y-3">
                  {s.features.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-ink/70">
                      <Check size={17} className="text-terracotta shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </Container>
      </Section>

      {services && services.length > 0 && (
        <Pricing services={services} fmtGhs={fmtGhs} isForeign={isForeign} currency={currency} />
      )}

      <Section tone="plum">
        <Container>
          <h2 className="font-display text-4xl sm:text-5xl mb-16">
            The <span className="italic text-champagne-light">process</span>
          </h2>
          <div className="grid md:grid-cols-4 gap-10">
            {process.map((p, i) => (
              <Reveal key={p.n} delay={i * 80}>
                <div className="font-display italic text-champagne text-3xl mb-4">{p.n}</div>
                <h3 className="font-display text-2xl mb-3">{p.title}</h3>
                <p className="text-cream/60 leading-relaxed text-sm">{p.desc}</p>
              </Reveal>
            ))}
          </div>
          <div className="mt-20 text-center">
            <Button to="/book" variant="gold" size="lg">
              Begin with a conversation <ArrowRight size={18} />
            </Button>
          </div>
        </Container>
      </Section>

      <FAQ />
    </>
  )
}
