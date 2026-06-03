// Centralized imagery. Unsplash CDN with format/quality params.
// Each entry pairs a remote photo with an on-brand gradient fallback,
// so a failed remote load degrades gracefully (see Img.jsx onError).
//
// Swap these for the studio's own photography later: keep the same keys
// and the whole site updates from one place.

const U = (id, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`

export const img = {
  hero: {
    src: U('1519225421980-715cb0215aed', 1920),
    alt: 'An elegantly styled wedding reception table set at dusk',
    fallback: 'from-plum via-plum-deep to-ink',
  },
  promise: {
    src: U('1478146896981-b80fe463b330', 1000),
    alt: 'Delicate floral centerpiece in soft natural light',
    fallback: 'from-terracotta/40 to-champagne/30',
  },
  about: {
    src: U('1511285560929-80b456fea0bc', 1000),
    alt: 'A couple sharing a quiet moment at their celebration',
    fallback: 'from-terracotta/30 via-champagne/20 to-plum/30',
  },
  contact: {
    src: U('1492684223066-81342ee5ff30', 1200),
    alt: 'Warm candlelight across a beautifully laid table',
    fallback: 'from-plum-soft/50 to-plum-deep/60',
  },
  // Service category imagery.
  weddings: {
    src: U('1465495976277-4387d4b0b4c6', 1000),
    alt: 'An outdoor garden wedding ceremony arch dressed in flowers',
    fallback: 'from-terracotta/30 to-plum/40',
  },
  celebrations: {
    src: U('1530103862676-de8c9debad1d', 1000),
    alt: 'A joyful celebration with warm ambient lighting',
    fallback: 'from-champagne/30 to-terracotta/20',
  },
  corporate: {
    src: U('1505373877841-8d25f7d46678', 1000),
    alt: 'A polished corporate gala dinner in an elegant venue',
    fallback: 'from-plum-soft/50 to-plum-deep/60',
  },
}

// Portfolio gallery. tone = fallback gradient; span = bento layout sizing.
export const gallery = [
  {
    title: 'A Garden Wedding',
    cat: 'Wedding',
    src: U('1519225421980-715cb0215aed', 1200),
    tone: 'from-terracotta/30 to-plum/40',
    span: 'md:col-span-2 md:row-span-2',
  },
  {
    title: 'Golden Anniversary',
    cat: 'Celebration',
    src: U('1530103862676-de8c9debad1d', 800),
    tone: 'from-champagne/30 to-plum/30',
    span: '',
  },
  {
    title: 'Brand Launch Gala',
    cat: 'Corporate',
    src: U('1505373877841-8d25f7d46678', 800),
    tone: 'from-plum-soft/50 to-plum-deep/60',
    span: '',
  },
  {
    title: 'Naming Ceremony',
    cat: 'Celebration',
    src: U('1464366400600-7168b8af9bc3', 800),
    tone: 'from-champagne-light/30 to-terracotta/20',
    span: '',
  },
  {
    title: 'Rooftop Reception',
    cat: 'Wedding',
    src: U('1556035511-3168381ea4d4', 1200),
    tone: 'from-plum/40 to-champagne/20',
    span: 'md:col-span-2',
  },
  {
    title: 'Candlelit Dinner',
    cat: 'Celebration',
    src: U('1492684223066-81342ee5ff30', 800),
    tone: 'from-terracotta/30 to-plum-deep/50',
    span: '',
  },
]
