import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { Container } from './ui/Section.jsx'
import KenteBand from './ui/KenteBand.jsx'
import CurrencySelect from './ui/CurrencySelect.jsx'
import { Menu, Close, TikTok, WhatsApp, Mail, MapPin, ArrowRight, Sparkles, ChevronDown } from '../lib/icons.jsx'

const primaryNav = [
  { to: '/services', label: 'Services' },
  { to: '/vendors', label: 'Vendors' },
  { to: '/portfolio', label: 'Portfolio' },
]
const moreNav = [
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]
const footerNav = [
  { to: '/', label: 'Home' },
  { to: '/services', label: 'Services' },
  { to: '/vendors', label: 'Vendors' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

const WHATSAPP_URL = 'https://wa.me/233505982361'
const TIKTOK_URL = 'https://www.tiktok.com/@gatherghana_events'
const EMAIL = 'hello@gatherghana.events'

function Logo({ light }) {
  return (
    <Link
      to="/"
      className="flex items-center gap-2.5 group rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-champagne"
      aria-label="Gather Ghana Events — home"
    >
      <span
        className={`grid place-items-center w-9 h-9 rounded-full border transition-colors ${
          light ? 'border-cream/40 text-cream' : 'border-plum/30 text-plum'
        }`}
      >
        <span className="font-display italic text-lg leading-none">g</span>
      </span>
      <span className={`font-display text-lg tracking-tight ${light ? 'text-cream' : 'text-plum'}`}>
        Gather <span className="italic">Ghana</span>
      </span>
    </Link>
  )
}

function MoreMenu({ light, items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { pathname } = useLocation()

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className={`inline-flex items-center gap-1 text-sm tracking-wide rounded transition-colors ${
          light ? 'text-cream/75 hover:text-cream' : 'text-plum/70 hover:text-plum'
        }`}
      >
        More <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-3 w-44 rounded-2xl bg-cream border border-plum/10 shadow-lg p-2 animate-fade-in">
          {items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-xl text-sm transition-colors ${
                  isActive ? 'text-plum font-medium bg-plum/5' : 'text-plum/75 hover:bg-plum/5 hover:text-plum'
                }`
              }
            >
              {i.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

function Header() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()
  const panelRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setOpen(false), [pathname])

  // Close on Escape; lock body scroll while the mobile panel is open.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    panelRef.current?.querySelector('a')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  // Every page opens on a dark hero, so the header is light + legible at the top
  // (with a subtle scrim over photos) and flips to a solid cream bar once scrolled.
  const onHero = !scrolled && !open

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        onHero ? 'py-5' : 'bg-cream/90 backdrop-blur-md border-b border-plum/10 py-3'
      }`}
    >
      {onHero && (
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-b from-plum-deep/70 via-plum-deep/25 to-transparent pointer-events-none"
          aria-hidden="true"
        />
      )}
      <Container className="flex items-center justify-between">
        <Logo light={onHero} />
        <nav className="hidden md:flex items-center gap-5 lg:gap-7" aria-label="Primary">
          {primaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `text-sm tracking-wide link-underline rounded transition-colors ${
                  onHero
                    ? isActive
                      ? 'text-cream font-medium'
                      : 'text-cream/75 hover:text-cream'
                    : isActive
                      ? 'text-plum font-medium'
                      : 'text-plum/70 hover:text-plum'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to="/concierge"
            className={`inline-flex items-center gap-1.5 text-sm font-medium tracking-wide link-underline rounded transition-colors ${
              onHero ? 'text-champagne-light hover:text-champagne' : 'text-terracotta hover:text-terracotta/80'
            }`}
          >
            <Sparkles size={15} /> Instant Quote
          </NavLink>
          <MoreMenu light={onHero} items={moreNav} />
          <CurrencySelect tone={onHero ? 'light' : 'dark'} />
          <Link
            to="/book"
            className={`inline-flex items-center gap-2 text-sm tracking-wide px-5 py-2.5 rounded-full transition-all shadow-sm hover:shadow-md ${
              onHero
                ? 'bg-champagne text-plum-deep hover:bg-champagne-light'
                : 'bg-plum text-cream hover:bg-plum-soft'
            }`}
          >
            Start Planning
          </Link>
        </nav>

        <button
          className={`md:hidden p-2 -mr-2 rounded-full transition-colors ${onHero ? 'text-cream' : 'text-plum'}`}
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-menu"
        >
          {open ? <Close size={26} /> : <Menu size={26} />}
        </button>
      </Container>

      {open && (
        <nav
          id="mobile-menu"
          ref={panelRef}
          className="md:hidden bg-cream border-t border-plum/10 mt-3 px-6 py-6 flex flex-col gap-2 animate-fade-in"
          aria-label="Mobile"
        >
          {primaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `text-plum text-xl font-display py-2 ${isActive ? 'italic text-terracotta' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to="/concierge"
            className={({ isActive }) =>
              `inline-flex items-center gap-2 text-terracotta text-xl font-display py-2 ${isActive ? 'italic' : ''}`
            }
          >
            <Sparkles size={18} /> Instant Quote
          </NavLink>
          <p className="mt-3 mb-1 text-xs uppercase tracking-widest text-ink/40">More</p>
          {moreNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `text-plum text-xl font-display py-2 ${isActive ? 'italic text-terracotta' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <Link
            to="/book"
            className="mt-3 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-plum text-cream font-medium"
          >
            Start Planning <ArrowRight size={18} />
          </Link>
        </nav>
      )}
    </header>
  )
}

function Footer() {
  return (
    <footer className="bg-plum-deep text-cream relative z-10">
      <KenteBand className="h-1.5" />
      <Container className="py-20">
        <div className="grid md:grid-cols-3 gap-12">
          <div>
            <Logo light />
            <p className="mt-5 text-cream/60 text-sm leading-relaxed max-w-xs">
              Bespoke event planning and styling in Accra. We design celebrations with
              intention, from the first hello to the last dance.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <a
                href={TIKTOK_URL}
                className="grid place-items-center w-10 h-10 rounded-full border border-cream/20 text-cream/80 hover:bg-cream/10 hover:text-cream transition-colors"
                aria-label="Gather Ghana on TikTok"
              >
                <TikTok size={18} />
              </a>
              <a
                href={WHATSAPP_URL}
                className="grid place-items-center w-10 h-10 rounded-full border border-cream/20 text-cream/80 hover:bg-cream/10 hover:text-cream transition-colors"
                aria-label="Chat on WhatsApp"
              >
                <WhatsApp size={18} />
              </a>
              <a
                href={`mailto:${EMAIL}`}
                className="grid place-items-center w-10 h-10 rounded-full border border-cream/20 text-cream/80 hover:bg-cream/10 hover:text-cream transition-colors"
                aria-label="Email us"
              >
                <Mail size={18} />
              </a>
            </div>
          </div>

          <div>
            <h2 className="font-display text-champagne-light text-sm tracking-widest uppercase mb-5">
              Explore
            </h2>
            <ul className="space-y-3 text-cream/70 text-sm">
              {footerNav.map((i) => (
                <li key={i.to}>
                  <Link to={i.to} className="link-underline">{i.label}</Link>
                </li>
              ))}
              <li><Link to="/playbooks" className="link-underline">Playbooks</Link></li>
              <li><Link to="/concierge" className="link-underline">Instant Quote</Link></li>
              <li><Link to="/guide" className="link-underline">Guide</Link></li>
              <li><Link to="/book" className="link-underline">Start Planning</Link></li>
              <li><Link to="/portal" className="link-underline">Client Portal</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="font-display text-champagne-light text-sm tracking-widest uppercase mb-5">
              Connect
            </h2>
            <ul className="space-y-3 text-cream/70 text-sm">
              <li>
                <a href={TIKTOK_URL} className="inline-flex items-center gap-2 link-underline">
                  <TikTok size={15} /> @gatherghana_events
                </a>
              </li>
              <li>
                <a href={WHATSAPP_URL} className="inline-flex items-center gap-2 link-underline">
                  <WhatsApp size={15} /> WhatsApp us
                </a>
              </li>
              <li>
                <a href={`mailto:${EMAIL}`} className="inline-flex items-center gap-2 link-underline">
                  <Mail size={15} /> {EMAIL}
                </a>
              </li>
              <li className="inline-flex items-center gap-2 text-cream/50">
                <MapPin size={15} /> Accra, Ghana
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-cream/10 flex flex-col sm:flex-row justify-between gap-4 text-xs text-cream/40">
          <span>© {new Date().getFullYear()} Gather Ghana Events. All rights reserved.</span>
          <span>Crafted by Hodges &amp; Co.</span>
        </div>
      </Container>
    </footer>
  )
}

// Persistent WhatsApp quick-action, kept clear of the mobile safe area.
function WhatsAppFab() {
  return (
    <a
      href={WHATSAPP_URL}
      className="fixed bottom-5 right-5 z-40 grid place-items-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg hover:scale-105 active:scale-95 transition-transform"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Chat with us on WhatsApp"
    >
      <WhatsApp size={28} />
    </a>
  )
}

export default function Layout() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])

  return (
    <div className="grain min-h-dvh flex flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-full focus:bg-plum focus:text-cream focus:text-sm"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" className="flex-1 relative z-10">
        <Outlet />
      </main>
      <Footer />
      <WhatsAppFab />
    </div>
  )
}
