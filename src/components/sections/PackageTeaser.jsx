import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container } from '../ui/Section.jsx'
import Button from '../ui/Button.jsx'
import { ArrowRight } from '../../lib/icons.jsx'

const TYPES = ['Wedding', 'Birthday', 'Corporate', 'Other']

/** Interactive homepage teaser: collects type/budget/guests and hands off to the builder. */
export default function PackageTeaser() {
  const navigate = useNavigate()
  const [type, setType] = useState('Wedding')
  const [budget, setBudget] = useState(50000)
  const [guests, setGuests] = useState(150)

  const build = () => {
    const qs = new URLSearchParams({ type, budget: String(budget || 0), guests: String(guests || 0) })
    navigate(`/concierge?${qs.toString()}`)
  }

  return (
    <section className="bg-plum-deep text-cream py-20 sm:py-24">
      <Container className="max-w-3xl text-center">
        <p className="text-champagne-light text-sm tracking-[0.3em] uppercase mb-4">Instant Package &amp; Quote</p>
        <h2 className="font-display text-cream text-3xl sm:text-4xl lg:text-5xl leading-tight">
          Your event, <span className="italic text-champagne-light">costed in 60 seconds</span>
        </h2>
        <p className="mt-4 text-cream/70 leading-relaxed">
          Budget breakdown, run-of-show, and a vendor shortlist — built instantly around your numbers.
        </p>

        <div className="mt-8 rounded-3xl bg-cream/5 border border-cream/15 p-6 sm:p-8 text-left">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
            {TYPES.map((t) => (
              <button key={t} type="button" onClick={() => setType(t)} aria-pressed={type === t}
                className={`py-2.5 rounded-xl border text-sm transition-all ${type === t ? 'border-champagne bg-champagne text-plum-deep' : 'border-cream/25 text-cream/80 hover:border-cream/60'}`}>{t}</button>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="text-cream/70">Budget (GH₵)</span>
              <input type="number" min="0" inputMode="numeric" value={budget}
                onChange={(e) => setBudget(Math.max(0, parseInt(e.target.value) || 0))}
                className="mt-1 w-full rounded-xl border border-cream/25 bg-plum/40 text-cream px-3 py-2.5 outline-none focus:border-champagne" />
            </label>
            <label className="block text-sm">
              <span className="text-cream/70">Guests</span>
              <input type="number" min="1" inputMode="numeric" value={guests}
                onChange={(e) => setGuests(Math.max(0, parseInt(e.target.value) || 0))}
                className="mt-1 w-full rounded-xl border border-cream/25 bg-plum/40 text-cream px-3 py-2.5 outline-none focus:border-champagne" />
            </label>
          </div>
          <Button onClick={build} variant="gold" size="lg" className="w-full mt-6">Build My Package <ArrowRight size={18} /></Button>
          <p className="mt-3 text-center text-xs text-cream/45">Free · no signup · takes seconds</p>
        </div>
      </Container>
    </section>
  )
}
