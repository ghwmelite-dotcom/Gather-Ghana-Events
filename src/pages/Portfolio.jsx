import { useState, useEffect, useCallback } from 'react'
import Seo from '../components/Seo.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Img from '../components/ui/Img.jsx'
import Reveal from '../components/ui/Reveal.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { Close, ArrowLeft, ArrowRight, TikTok } from '../lib/icons.jsx'
import { gallery } from '../lib/images.js'

function Lightbox({ index, onClose, onNav }) {
  const item = gallery[index]

  const onKey = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onNav(1)
      if (e.key === 'ArrowLeft') onNav(-1)
    },
    [onClose, onNav]
  )

  useEffect(() => {
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onKey])

  return (
    <div
      className="fixed inset-0 z-[90] bg-plum-deep/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`${item.title}, ${item.cat}`}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-5 right-5 grid place-items-center w-11 h-11 rounded-full bg-cream/10 text-cream hover:bg-cream/20 transition-colors"
        aria-label="Close gallery"
      >
        <Close size={22} />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onNav(-1) }}
        className="absolute left-3 sm:left-6 grid place-items-center w-11 h-11 rounded-full bg-cream/10 text-cream hover:bg-cream/20 transition-colors"
        aria-label="Previous"
      >
        <ArrowLeft size={22} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onNav(1) }}
        className="absolute right-3 sm:right-6 grid place-items-center w-11 h-11 rounded-full bg-cream/10 text-cream hover:bg-cream/20 transition-colors"
        aria-label="Next"
      >
        <ArrowRight size={22} />
      </button>

      <figure
        className="max-w-4xl w-full animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <Img
          src={item.src}
          alt={item.title}
          fallback={item.tone}
          ratio="3 / 2"
          eager
          className="rounded-2xl"
        />
        <figcaption className="mt-4 text-center text-cream">
          <span className="text-champagne-light text-xs tracking-[0.2em] uppercase">{item.cat}</span>
          <p className="font-display text-2xl mt-1">{item.title}</p>
        </figcaption>
      </figure>
    </div>
  )
}

export default function Portfolio() {
  const [active, setActive] = useState(null)

  const nav = useCallback(
    (dir) => setActive((i) => (i + dir + gallery.length) % gallery.length),
    []
  )

  return (
    <>
      <Seo
        title="Portfolio"
        description="A selection of weddings, celebrations, and corporate events designed by Gather Ghana Events in Accra."
      />
      <PageHeader
        eyebrow="Portfolio"
        title={<>A few of the <span className="italic text-champagne-light">moments</span> we&apos;ve made</>}
        subtitle="A selection of recent events. Each one designed around the people at its heart."
      />

      <Section tone="cream">
        <Container>
          <div className="grid md:grid-cols-3 auto-rows-[260px] sm:auto-rows-[280px] gap-5">
            {gallery.map((p, i) => (
              <Reveal
                as="button"
                key={p.title}
                delay={(i % 3) * 80}
                onClick={() => setActive(i)}
                className={`group relative rounded-2xl overflow-hidden text-left shadow-sm hover:shadow-lg transition-shadow ${p.span}`}
                aria-label={`View ${p.title}, ${p.cat}`}
              >
                <Img
                  src={p.src}
                  alt={p.title}
                  fallback={p.tone}
                  className="absolute inset-0"
                  imgClassName="group-hover:scale-105 transition-transform duration-700 ease-out-expo"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-plum-deep/70 via-plum-deep/10 to-transparent group-hover:from-plum-deep/80 transition-colors duration-500" />
                <div className="absolute inset-0 p-7 flex flex-col justify-end">
                  <span className="text-cream/80 text-xs tracking-[0.2em] uppercase mb-2 translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                    {p.cat}
                  </span>
                  <h3 className="font-display text-cream text-2xl translate-y-2 group-hover:translate-y-0 transition-transform duration-500 delay-75">
                    {p.title}
                  </h3>
                </div>
              </Reveal>
            ))}
          </div>

          <p className="mt-12 text-center text-ink/55 text-sm inline-flex items-center justify-center gap-2 w-full">
            More on our TikTok ·{' '}
            <a
              href="https://www.tiktok.com/@gatherghana_events"
              className="text-terracotta link-underline inline-flex items-center gap-1.5"
            >
              <TikTok size={15} /> @gatherghana_events
            </a>
          </p>
        </Container>
      </Section>

      {active !== null && (
        <Lightbox index={active} onClose={() => setActive(null)} onNav={nav} />
      )}
    </>
  )
}
