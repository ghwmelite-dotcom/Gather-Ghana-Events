import { useState, useEffect } from 'react'
import { Section, Container, Eyebrow } from '../ui/Section.jsx'
import Reveal from '../ui/Reveal.jsx'
import { Quote, Star } from '../../lib/icons.jsx'
import { api } from '../../lib/api.js'

export default function Testimonials({ tone = 'creamDeep' }) {
  const [testimonials, setTestimonials] = useState(null)
  useEffect(() => {
    let cancelled = false
    api.content().then((r) => { if (!cancelled) setTestimonials(r.testimonial || []) }).catch(() => { if (!cancelled) setTestimonials([]) })
    return () => { cancelled = true }
  }, [])
  if (!testimonials || testimonials.length === 0) return null

  return (
    <Section tone={tone}>
      <Container>
        <div className="max-w-2xl mb-14">
          <Eyebrow className="text-terracotta mb-4">Kind words</Eyebrow>
          <h2 className="font-display text-plum text-4xl sm:text-5xl leading-tight text-balance">
            Trusted with the moments that <span className="italic">matter most</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <Reveal key={t.id} delay={i * 90} className="flex flex-col rounded-2xl bg-cream p-8 shadow-sm border border-plum/5">
              <Quote size={28} className="text-champagne" />
              <div className="mt-3 flex gap-0.5 text-champagne" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} size={15} className="fill-champagne" />
                ))}
              </div>
              <blockquote className="mt-4 text-ink/80 leading-relaxed flex-1">"{t.quote}"</blockquote>
              <div className="mt-6 pt-5 border-t border-plum/10">
                <p className="font-display text-plum text-lg">{t.name}</p>
                <p className="text-ink/50 text-sm">{t.event}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  )
}
