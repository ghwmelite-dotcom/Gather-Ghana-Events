import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Reveal from '../components/ui/Reveal.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { ArrowRight } from '../lib/icons.jsx'
import { playbooks } from '../lib/playbooks.js'
import { img } from '../lib/images.js'

export default function Playbooks() {
  return (
    <>
      <Seo title="Event Playbooks" description="Ready-made cultural event playbooks — traditional marriages, outdoorings, white weddings, galas — with schedules, checklists, and budgets." />
      <PageHeader
        eyebrow="Playbooks"
        title={<>Start from a <span className="italic text-champagne-light">playbook</span></>}
        subtitle="Culturally-rooted templates with a schedule, checklist, and budget split — a head start you can make your own."
        image={img.weddings.src}
      />
      <Section tone="cream">
        <Container>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {playbooks.map((p, i) => (
              <Reveal as={Link} key={p.slug} to={`/playbooks/${p.slug}`} delay={(i % 3) * 80}
                className="group rounded-3xl overflow-hidden bg-cream-deep border border-plum/8 shadow-sm hover:shadow-lg transition-shadow">
                <div className={`h-28 bg-gradient-to-br ${p.fallback} flex items-end p-5`}>
                  <div className="flex gap-1.5">
                    {p.palette.map((c) => <span key={c} className="w-5 h-5 rounded-full border border-white/40" style={{ background: c }} />)}
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-xs uppercase tracking-widest text-terracotta">{p.culture}</p>
                  <h3 className="font-display text-plum text-2xl mt-1">{p.name}</h3>
                  <p className="text-ink/70 text-sm mt-2 leading-relaxed">{p.summary}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm text-plum group-hover:gap-2.5 transition-all">View playbook <ArrowRight size={16} /></span>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>
    </>
  )
}
