import Seo from '../components/Seo.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import Img from '../components/ui/Img.jsx'
import Reveal from '../components/ui/Reveal.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { ArrowRight } from '../lib/icons.jsx'
import { adinkra } from '../lib/adinkra.jsx'
import { img } from '../lib/images.js'

// Each value is anchored to an Adinkra symbol that carries the same idea.
const values = [
  { title: 'Presence', adinkra: adinkra.akoma, desc: 'We carry the details so you can be fully in the moment with the people who matter.' },
  { title: 'Craft', adinkra: adinkra.duafe, desc: 'Considered design in everything, from the first mood board to the final table setting.' },
  { title: 'Warmth', adinkra: adinkra.nkonsonkonson, desc: 'Every client is treated as our only client. Your celebration is personal to us, too.' },
]

export default function About() {
  return (
    <>
      <Seo
        title="About"
        description="Gather Ghana Events is a full-service planning and styling studio in Accra — planners, stylists, and storytellers who design celebrations with intention."
      />
      <PageHeader
        eyebrow="About"
        title={<>Planners, stylists, and <span className="italic text-champagne-light">storytellers</span></>}
        image={img.about.src}
      />

      <Section tone="cream">
        <Container className="grid md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-7">
            <Reveal
              as="p"
              className="font-display text-plum text-3xl sm:text-4xl leading-tight text-balance"
            >
              Gather Ghana Events began with a simple belief: that the events marking our
              lives deserve to be designed with the same care as the memories they leave
              behind.
            </Reveal>
            <div className="mt-8 space-y-5 text-ink/70 text-lg leading-relaxed max-w-prose">
              <Reveal as="p" delay={80}>
                Based in Accra, we are a full-service planning and styling studio working
                across weddings, celebrations, and corporate events. We&apos;ve grown through
                word of mouth, one beautiful gathering at a time, because we treat every
                event as if it were our own.
              </Reveal>
              <Reveal as="p" delay={140}>
                Our approach is calm and collaborative. We listen first, design with
                intention, and manage the logistics with a steady hand — so that on the day,
                everything simply feels right.
              </Reveal>
            </div>
          </div>
          <Reveal className="md:col-span-5 md:pl-4">
            <Img
              src={img.about.src}
              alt={img.about.alt}
              fallback={img.about.fallback}
              ratio="4 / 5"
              className="rounded-3xl shadow-lg"
            />
          </Reveal>
        </Container>
      </Section>

      <Section tone="plum">
        <Container>
          <h2 className="font-display text-4xl sm:text-5xl mb-16">
            What we <span className="italic text-champagne-light">value</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-12">
            {values.map((v, i) => {
              const { Symbol, name } = v.adinkra
              return (
                <Reveal key={v.title} delay={i * 90} className="border-t border-cream/20 pt-6">
                  <Symbol size={40} className="text-champagne mb-5" />
                  <h3 className="font-display text-2xl">{v.title}</h3>
                  <p className="text-champagne-light/80 text-xs uppercase tracking-[0.2em] mt-1 mb-3">
                    {name}
                  </p>
                  <p className="text-cream/60 leading-relaxed">{v.desc}</p>
                </Reveal>
              )
            })}
          </div>
          <div className="mt-20 text-center">
            <Button to="/book" variant="gold" size="lg">
              Work with us <ArrowRight size={18} />
            </Button>
          </div>
        </Container>
      </Section>
    </>
  )
}
