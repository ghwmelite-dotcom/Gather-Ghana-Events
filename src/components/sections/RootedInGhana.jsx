import { Section, Container, Eyebrow } from '../ui/Section.jsx'
import Reveal from '../ui/Reveal.jsx'
import KenteBand from '../ui/KenteBand.jsx'
import { adinkra } from '../../lib/adinkra.jsx'

const featured = [adinkra.sankofa, adinkra.akoma, adinkra.nkonsonkonson]

export default function RootedInGhana() {
  return (
    <Section tone="plum" className="overflow-hidden">
      <KenteBand className="h-1.5 absolute top-0 inset-x-0" />
      <Container>
        <div className="grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5">
            <Eyebrow className="text-champagne-light mb-4">Akwaaba</Eyebrow>
            <h2 className="font-display text-4xl sm:text-5xl leading-tight text-balance">
              Celebrating the <span className="italic text-champagne-light">Ghanaian</span> way
            </h2>
            <p className="mt-6 text-cream/70 text-lg leading-relaxed max-w-prose">
              From the knocking and engagement to the outdooring of a new child, our
              traditions are rich with meaning. We honour them with modern styling and quiet
              precision — so every ceremony feels both deeply rooted and effortlessly elegant.
            </p>
          </div>

          <div className="lg:col-span-7 grid sm:grid-cols-3 gap-5">
            {featured.map(({ Symbol, name, meaning }, i) => (
              <Reveal
                key={name}
                delay={i * 90}
                className="rounded-2xl border border-cream/12 bg-cream/[0.03] p-6 hover:bg-cream/[0.06] transition-colors"
              >
                <Symbol size={44} className="text-champagne" />
                <h3 className="font-display text-xl mt-4">{name}</h3>
                <p className="text-cream/55 text-sm mt-1.5 leading-relaxed">{meaning}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  )
}
