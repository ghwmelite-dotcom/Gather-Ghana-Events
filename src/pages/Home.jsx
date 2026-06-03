import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import Img from '../components/ui/Img.jsx'
import Reveal from '../components/ui/Reveal.jsx'
import { Section, Container, Eyebrow } from '../components/ui/Section.jsx'
import Testimonials from '../components/sections/Testimonials.jsx'
import RootedInGhana from '../components/sections/RootedInGhana.jsx'
import { ArrowRight, Heart, Sparkles, Building } from '../lib/icons.jsx'
import { img } from '../lib/images.js'

function Hero() {
  return (
    <section className="relative min-h-dvh flex items-end overflow-hidden bg-plum-deep">
      {/* Background photograph (LCP) with layered atmosphere over it. */}
      <img
        src={img.hero.src}
        alt=""
        aria-hidden="true"
        fetchpriority="high"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-t from-plum-deep via-plum-deep/85 to-plum/50" />
        <div className="absolute -top-32 -right-32 w-[40rem] h-[40rem] rounded-full bg-champagne/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 rounded-full bg-terracotta/10 blur-3xl" />
      </div>

      <Container className="relative z-10 pb-24 pt-40">
        <p className="rise rise-1 text-champagne-light text-sm tracking-[0.3em] uppercase mb-8">
          Akwaaba · Bespoke Event Planning · Accra
        </p>
        <h1 className="rise rise-2 font-display text-cream text-5xl sm:text-7xl lg:text-8xl leading-[0.95] max-w-4xl text-balance">
          Every gathering,
          <br />
          <span className="italic text-champagne-light">designed with</span> intention.
        </h1>
        <p className="rise rise-3 mt-10 text-cream/75 text-lg leading-relaxed max-w-2xl">
          From intimate celebrations to corporate showcases, we craft events that feel
          effortless and unforgettable — attending to every detail so you can simply be
          present.
        </p>
        <div className="rise rise-4 mt-10 flex flex-wrap items-center gap-4">
          <Button to="/book" variant="gold" size="lg">
            Start Planning Your Event <ArrowRight size={18} />
          </Button>
          <Button to="/portfolio" variant="ghostLight" size="lg">
            View Our Work
          </Button>
        </div>
      </Container>
    </section>
  )
}

function Intro() {
  return (
    <Section tone="cream">
      <Container className="grid md:grid-cols-12 gap-10 lg:gap-14 items-center">
        <Reveal className="md:col-span-5">
          <Img
            src={img.promise.src}
            alt={img.promise.alt}
            fallback={img.promise.fallback}
            ratio="4 / 5"
            className="rounded-3xl shadow-lg"
          />
        </Reveal>
        <div className="md:col-span-7">
          <Reveal as="span" className="inline-block font-display italic text-champagne text-2xl">
            Our promise
          </Reveal>
          <Reveal
            as="p"
            delay={80}
            className="mt-4 font-display text-plum text-3xl sm:text-4xl leading-tight text-balance"
          >
            The difference between a good event and an unforgettable one lives in the
            details no one notices — but everyone feels.
          </Reveal>
          <Reveal
            as="p"
            delay={160}
            className="mt-8 text-ink/70 text-lg leading-relaxed max-w-prose"
          >
            Gather Ghana Events is a full-service planning and styling studio. We make every
            client feel like our only client, guiding you from the first idea to the final
            farewell with calm, clarity, and craft.
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}

const services = [
  { Icon: Heart, n: '01', title: 'Weddings', desc: 'From traditional ceremonies to modern celebrations, designed around your story.' },
  { Icon: Sparkles, n: '02', title: 'Celebrations', desc: 'Birthdays, anniversaries, and milestones styled to feel personal and alive.' },
  { Icon: Building, n: '03', title: 'Corporate', desc: 'Launches, galas, and conferences that reflect your brand with polish.' },
]

function ServicesPreview() {
  return (
    <Section tone="plum">
      <Container>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-16">
          <h2 className="font-display text-4xl sm:text-5xl max-w-md text-balance">
            What we <span className="italic text-champagne-light">create</span>
          </h2>
          <Button to="/services" variant="ghostLight" size="sm">
            All services <ArrowRight size={16} />
          </Button>
        </div>
        <div className="grid md:grid-cols-3 gap-px bg-cream/10 rounded-2xl overflow-hidden">
          {services.map((s, i) => (
            <Reveal
              key={s.n}
              delay={i * 90}
              className="bg-plum p-10 hover:bg-plum-soft transition-colors"
            >
              <s.Icon size={28} className="text-champagne" />
              <span className="block font-display italic text-champagne/60 text-xl mt-6">{s.n}</span>
              <h3 className="font-display text-3xl mt-2 mb-3">{s.title}</h3>
              <p className="text-cream/60 leading-relaxed">{s.desc}</p>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  )
}

const stats = [
  { figure: '200+', label: 'Events designed' },
  { figure: '6 yrs', label: 'Crafting gatherings' },
  { figure: '98%', label: 'Referral & repeat clients' },
  { figure: '24h', label: 'Inquiry response time' },
]

function Stats() {
  return (
    <Section tone="cream" pad="md">
      <Container className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 80} className="border-t border-plum/20 pt-6">
            <div className="font-display text-plum text-5xl sm:text-6xl tnum">{s.figure}</div>
            <div className="mt-3 text-ink/60 text-sm tracking-wide uppercase">{s.label}</div>
          </Reveal>
        ))}
      </Container>
    </Section>
  )
}

function CTA() {
  return (
    <Section tone="pale">
      <Container className="max-w-4xl text-center">
        <span className="font-display italic text-terracotta text-2xl">Let&apos;s begin</span>
        <h2 className="font-display text-plum text-4xl sm:text-6xl mt-4 leading-tight text-balance">
          Tell us about the event you&apos;re dreaming of.
        </h2>
        <p className="mt-6 text-ink/70 text-lg max-w-xl mx-auto">
          Share your date and vision, and we&apos;ll be in touch within a day to start
          shaping something beautiful together.
        </p>
        <div className="mt-10 flex justify-center">
          <Button to="/book" variant="primary" size="lg">
            Start Planning <ArrowRight size={18} />
          </Button>
        </div>
      </Container>
    </Section>
  )
}

export default function Home() {
  return (
    <>
      <Seo />
      <Hero />
      <Intro />
      <ServicesPreview />
      <Stats />
      <RootedInGhana />
      <Testimonials />
      <CTA />
    </>
  )
}
