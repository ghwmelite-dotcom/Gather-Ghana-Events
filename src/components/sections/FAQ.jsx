import { useState, useId } from 'react'
import { Section, Container, Eyebrow } from '../ui/Section.jsx'
import { ChevronDown } from '../../lib/icons.jsx'
import { faqs } from '../../lib/content.js'

function Item({ q, a, open, onToggle }) {
  const id = useId()
  return (
    <div className="border-b border-plum/12">
      <h3>
        <button
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          id={`${id}-btn`}
          className="w-full flex items-center justify-between gap-6 py-6 text-left group"
        >
          <span className="font-display text-plum text-xl sm:text-2xl group-hover:text-terracotta transition-colors">
            {q}
          </span>
          <span
            className={`shrink-0 grid place-items-center w-9 h-9 rounded-full border border-plum/20 text-plum transition-transform duration-300 ${
              open ? 'rotate-180 bg-plum text-cream border-plum' : ''
            }`}
          >
            <ChevronDown size={18} />
          </span>
        </button>
      </h3>
      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-btn`}
        hidden={!open}
        className="pb-6 -mt-1"
      >
        <p className="text-ink/70 leading-relaxed max-w-prose">{a}</p>
      </div>
    </div>
  )
}

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState(0)

  return (
    <Section tone="cream" id="faq">
      <Container className="max-w-3xl">
        <div className="text-center mb-12">
          <Eyebrow className="text-terracotta mb-4">Questions</Eyebrow>
          <h2 className="font-display text-plum text-4xl sm:text-5xl leading-tight">
            Things clients often <span className="italic">ask</span>
          </h2>
        </div>
        <div>
          {faqs.map((f, i) => (
            <Item
              key={f.q}
              q={f.q}
              a={f.a}
              open={openIdx === i}
              onToggle={() => setOpenIdx(openIdx === i ? -1 : i)}
            />
          ))}
        </div>
      </Container>
    </Section>
  )
}
