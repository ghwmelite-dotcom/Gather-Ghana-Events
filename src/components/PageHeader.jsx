import { Container, Eyebrow } from './ui/Section.jsx'

/**
 * Reusable hero header for inner pages.
 * Optionally renders a darkened background image with the plum overlay.
 */
export default function PageHeader({ eyebrow, title, subtitle, image }) {
  return (
    <section className="relative overflow-hidden bg-plum-deep text-cream pt-40 pb-20">
      {image ? (
        <>
          <img
            src={image}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-plum-deep via-plum-deep/85 to-plum-deep/60" />
        </>
      ) : (
        <div className="absolute -top-20 right-0 w-96 h-96 rounded-full bg-champagne/10 blur-3xl" />
      )}

      <Container className="relative z-10">
        {eyebrow && (
          <Eyebrow className="rise rise-1 text-champagne-light mb-6">{eyebrow}</Eyebrow>
        )}
        <h1 className="rise rise-2 font-display text-5xl sm:text-7xl leading-[0.95] max-w-3xl text-balance">
          {title}
        </h1>
        {subtitle && (
          <p className="rise rise-3 mt-8 text-cream/70 text-lg max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </Container>
    </section>
  )
}
