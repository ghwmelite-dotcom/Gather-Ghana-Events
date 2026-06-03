import Seo from '../components/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import { Section, Container } from '../components/ui/Section.jsx'
import { ArrowLeft } from '../lib/icons.jsx'

export default function NotFound() {
  return (
    <>
      <Seo title="Page not found" noindex />
      <Section tone="plumDeep" className="min-h-dvh flex items-center">
        <Container className="text-center pt-24">
          <p className="font-display italic text-champagne-light text-7xl sm:text-8xl">404</p>
          <h1 className="font-display text-cream text-3xl sm:text-4xl mt-4">
            This page has wandered off.
          </h1>
          <p className="mt-4 text-cream/60 max-w-md mx-auto">
            The page you&apos;re looking for doesn&apos;t exist or has moved. Let&apos;s get
            you back to something beautiful.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button to="/" variant="gold" size="md">
              <ArrowLeft size={18} /> Back home
            </Button>
            <Button to="/contact" variant="ghostLight" size="md">
              Contact us
            </Button>
          </div>
        </Container>
      </Section>
    </>
  )
}
