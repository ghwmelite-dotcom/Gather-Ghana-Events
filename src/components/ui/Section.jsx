/**
 * Layout primitives for consistent rhythm and max-width across pages.
 * Section handles vertical padding + theme background.
 * Container handles horizontal gutters + max-width.
 */

const tones = {
  cream: 'bg-cream text-ink',
  creamDeep: 'bg-cream-deep text-ink',
  plum: 'bg-plum text-cream',
  plumDeep: 'bg-plum-deep text-cream',
  pale: 'bg-champagne-pale text-ink',
}

const pads = {
  sm: 'py-16 sm:py-20',
  md: 'py-20 sm:py-24',
  lg: 'py-24 sm:py-28',
}

export function Container({ className = '', children }) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-6 sm:px-8 ${className}`}>
      {children}
    </div>
  )
}

export function Section({ tone = 'cream', pad = 'lg', id, className = '', children }) {
  return (
    <section id={id} className={`relative z-10 ${tones[tone]} ${pads[pad]} ${className}`}>
      {children}
    </section>
  )
}

/** Small uppercase tracked label used above headings. */
export function Eyebrow({ children, className = '' }) {
  return (
    <p className={`text-sm uppercase tracking-[0.3em] ${className}`}>{children}</p>
  )
}
