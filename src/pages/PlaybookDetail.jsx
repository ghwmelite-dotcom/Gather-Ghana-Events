import { useParams, Link, Navigate } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import Reveal from '../components/ui/Reveal.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { Check, ArrowRight, ArrowLeft } from '../lib/icons.jsx'
import { getPlaybook } from '../lib/playbooks.js'

export default function PlaybookDetail() {
  const { slug } = useParams()
  const p = getPlaybook(slug)
  if (!p) return <Navigate to="/playbooks" replace />

  return (
    <>
      <Seo title={`${p.name} Playbook`} description={p.summary} />
      <PageHeader eyebrow={p.culture} title={<>{p.name} <span className="italic text-champagne-light">playbook</span></>} subtitle={p.summary} />

      <Section tone="cream">
        <Container>
          <Link to="/playbooks" className="inline-flex items-center gap-2 text-ink/55 hover:text-plum text-sm mb-8"><ArrowLeft size={16} /> All playbooks</Link>
          <div className="grid lg:grid-cols-3 gap-10 items-start">
            {/* Schedule */}
            <div className="lg:col-span-2 space-y-10">
              <div>
                <h2 className="font-display text-plum text-2xl mb-5">Order of the day</h2>
                <ol className="space-y-4">
                  {p.schedule.map((s, i) => (
                    <Reveal as="li" key={i} delay={i * 60} className="flex gap-5 rounded-2xl bg-cream-deep border border-plum/8 p-5">
                      <span className="font-display text-terracotta w-24 shrink-0">{s.time}</span>
                      <div>
                        <p className="font-display text-plum text-lg">{s.title}</p>
                        <p className="text-ink/60 text-sm mt-0.5">{s.description}</p>
                      </div>
                    </Reveal>
                  ))}
                </ol>
              </div>
              <div>
                <h2 className="font-display text-plum text-2xl mb-5">Checklist</h2>
                <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
                  {p.checklist.map((c) => (
                    <li key={c} className="flex items-center gap-3 text-sm text-ink/75"><Check size={17} className="text-kente shrink-0" /> {c}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Budget + CTA */}
            <div className="space-y-6 lg:sticky lg:top-28">
              <div className="rounded-3xl bg-cream-deep border border-plum/8 p-7">
                <h2 className="font-display text-plum text-xl mb-5">Where the budget goes</h2>
                <ul className="space-y-3">
                  {p.budget.map((b) => (
                    <li key={b.label}>
                      <div className="flex justify-between text-sm mb-1"><span className="text-ink/70">{b.label}</span><span className="text-plum tnum">{b.pct}%</span></div>
                      <div className="h-2 rounded-full bg-plum/10 overflow-hidden"><div className="h-full bg-champagne rounded-full" style={{ width: `${b.pct}%` }} /></div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl bg-plum text-cream p-7">
                <p className="font-display text-xl">Make it yours</p>
                <p className="text-cream/65 text-sm mt-1">We&apos;ll tailor this playbook to your vision and budget.</p>
                <Button to="/book" variant="gold" size="md" className="w-full mt-5">Start planning <ArrowRight size={18} /></Button>
                <Button to="/concierge" variant="ghostLight" size="md" className="w-full mt-3">Try the AI concierge</Button>
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  )
}
