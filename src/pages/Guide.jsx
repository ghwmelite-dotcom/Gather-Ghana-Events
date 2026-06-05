import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import * as Icons from '../lib/icons.jsx'
import { GUIDE_OVERVIEW, GUIDE_GROUPS } from '../lib/guide.js'

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function Icon({ name, ...props }) {
  const C = Icons[name] || Icons.Sparkles
  return <C {...props} />
}

const scrollToId = (id) => {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })
}

export default function Guide() {
  const [active, setActive] = useState(GUIDE_OVERVIEW.id)
  const sectionIds = useRef([GUIDE_OVERVIEW.id, ...GUIDE_GROUPS.flatMap((g) => g.sections.map((s) => s.id))])

  // Deep links like /guide#clients or /guide#org-escrow scroll into view on load.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id) setTimeout(() => scrollToId(id), 50)
  }, [])

  // Scroll-spy: mark the section nearest the top as active.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id) }),
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    )
    sectionIds.current.forEach((id) => {
      const el = document.getElementById(id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [])

  const onTocClick = (e, id) => {
    e.preventDefault()
    scrollToId(id)
    history.replaceState(null, '', `#${id}`)
    setActive(id)
  }

  return (
    <>
      <Seo title="Guide" description="How to use Gather Ghana Events — for organizers, clients and guests." />

      <section className="bg-plum-deep text-cream pt-32 pb-14">
        <Container>
          <p className="text-champagne-light text-sm tracking-[0.3em] uppercase mb-3">Guide</p>
          <h1 className="font-display text-4xl sm:text-5xl max-w-2xl">Everything you need to run and enjoy Gather Ghana.</h1>
          <p className="text-cream/70 mt-4 max-w-xl">A quick walkthrough of the planner dashboard and the client experience — pick a topic on the left.</p>
        </Container>
      </section>

      <Section tone="cream" pad="md">
        <Container className="grid lg:grid-cols-[230px_1fr] gap-10 items-start">
          {/* Sticky TOC (desktop) */}
          <nav aria-label="Guide contents" className="hidden lg:block lg:sticky lg:top-28">
            <ul className="space-y-1.5 border-l border-plum/10 mb-6">
              <li>
                <a
                  href="#overview"
                  onClick={(e) => onTocClick(e, 'overview')}
                  className={`block pl-3 -ml-px border-l-2 text-sm transition-colors ${active === 'overview' ? 'border-terracotta text-plum font-medium' : 'border-transparent text-ink/55 hover:text-plum'}`}
                >
                  Overview
                </a>
              </li>
            </ul>
            {GUIDE_GROUPS.map((g) => (
              <div key={g.id} className="mb-6">
                <p className="text-xs uppercase tracking-wider text-ink/40 mb-2">{g.label}</p>
                <ul className="space-y-1.5 border-l border-plum/10">
                  {g.sections.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        onClick={(e) => onTocClick(e, s.id)}
                        className={`block pl-3 -ml-px border-l-2 text-sm transition-colors ${active === s.id ? 'border-terracotta text-plum font-medium' : 'border-transparent text-ink/55 hover:text-plum'}`}
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="max-w-2xl">
            {/* Mobile TOC */}
            <details className="lg:hidden mb-8 rounded-2xl bg-cream-deep border border-plum/8 p-4">
              <summary className="font-display text-plum cursor-pointer">Contents</summary>
              <div className="mt-3 space-y-3">
                <a href="#overview" className="block text-sm text-terracotta link-underline">Overview</a>
                {GUIDE_GROUPS.map((g) => (
                  <div key={g.id}>
                    <p className="text-xs uppercase tracking-wider text-ink/40 mb-1">{g.label}</p>
                    <ul className="space-y-1">
                      {g.sections.map((s) => (
                        <li key={s.id}><a href={`#${s.id}`} className="text-sm text-terracotta link-underline">{s.title}</a></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>

            <section id="overview" className="scroll-mt-28 mb-12">
              <h2 className="font-display text-plum text-3xl">{GUIDE_OVERVIEW.title}</h2>
              <div className="mt-3 space-y-3">
                {GUIDE_OVERVIEW.lead.map((para, i) => <p key={i} className="text-ink/70 leading-relaxed">{para}</p>)}
              </div>
              <div className="mt-6 grid sm:grid-cols-2 gap-3">
                {GUIDE_OVERVIEW.highlights.map((h) => (
                  <div key={h.title} className="rounded-2xl bg-cream-deep border border-plum/8 p-4 flex gap-3">
                    <span className="grid place-items-center w-9 h-9 rounded-full bg-plum/5 text-terracotta shrink-0"><Icon name={h.icon} size={18} /></span>
                    <div>
                      <p className="font-display text-plum text-sm">{h.title}</p>
                      <p className="text-ink/60 text-xs leading-relaxed mt-0.5">{h.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-ink/55 text-sm italic">{GUIDE_OVERVIEW.closing}</p>
            </section>

            {GUIDE_GROUPS.map((g) => (
              <div key={g.id} id={g.id} className="mb-12 scroll-mt-28">
                <h2 className="font-display text-plum text-3xl">{g.label}</h2>
                <p className="text-ink/60 mt-1 mb-7">{g.blurb}</p>
                <div className="space-y-7">
                  {g.sections.map((s) => (
                    <section key={s.id} id={s.id} className="scroll-mt-28 rounded-3xl bg-cream-deep border border-plum/8 p-7">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="grid place-items-center w-10 h-10 rounded-full bg-plum/5 text-terracotta shrink-0">
                          <Icon name={s.icon} size={20} />
                        </span>
                        <h3 className="font-display text-plum text-xl">{s.title}</h3>
                      </div>
                      <p className="text-ink/70 leading-relaxed">{s.intro}</p>
                      {s.steps && (
                        <ol className="mt-4 space-y-2">
                          {s.steps.map((step, i) => (
                            <li key={i} className="flex gap-3 text-ink/70 text-sm leading-relaxed">
                              <span className="grid place-items-center w-5 h-5 rounded-full bg-plum text-cream text-[11px] shrink-0 mt-0.5 tnum">{i + 1}</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                      {s.note && <p className="mt-4 text-sm text-ink/55 border-t border-plum/10 pt-3 italic">{s.note}</p>}
                    </section>
                  ))}
                </div>
              </div>
            ))}

            <div className="rounded-3xl bg-plum text-cream p-7 text-center">
              <p className="font-display text-xl">Still have a question?</p>
              <p className="text-cream/70 text-sm mt-1 mb-4">We’re happy to help you plan.</p>
              <Link to="/contact" className="inline-flex items-center gap-2 rounded-full bg-champagne text-plum-deep px-5 py-2.5 text-sm hover:bg-champagne-light transition-colors">Contact us</Link>
            </div>
          </div>
        </Container>
      </Section>
    </>
  )
}
