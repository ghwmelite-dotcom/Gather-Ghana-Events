// Centralized imagery — curated, real Ghanaian / West African wedding & event
// photography from Unsplash (free license). Each entry pairs a remote photo with
// an on-brand gradient fallback, so a failed load degrades gracefully (Img.jsx).
//
// Swap these for the studio's own photography later: keep the same keys and the
// whole site updates from one place.

const U = (id, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`

export const img = {
  hero: {
    src: U('1695281536457-01f9a07c575b', 1920),
    alt: 'A couple embracing outdoors at their wedding celebration',
    fallback: 'from-plum via-plum-deep to-ink',
  },
  promise: {
    src: U('1617813437449-c4f8f233dcd6', 1000),
    alt: 'Soft white and blush florals styled on a celebration table',
    fallback: 'from-terracotta/40 to-champagne/30',
  },
  about: {
    src: U('1695281535578-ce371088bb3e', 1000),
    alt: 'A couple posing together on their wedding day',
    fallback: 'from-terracotta/30 via-champagne/20 to-plum/30',
  },
  contact: {
    src: U('1739295193748-250cca77503a', 1200),
    alt: 'A long banquet table beautifully laid for a reception',
    fallback: 'from-plum-soft/50 to-plum-deep/60',
  },
  weddings: {
    src: U('1661332517932-2d441bfb2994', 1000),
    alt: 'A couple in traditional dress during their wedding rites',
    fallback: 'from-terracotta/30 to-plum/40',
  },
  celebrations: {
    src: U('1618999114008-fbf937170cdb', 1000),
    alt: 'A guest in a vibrant red and gold outfit at a celebration',
    fallback: 'from-champagne/30 to-terracotta/20',
  },
  corporate: {
    src: U('1768508950719-4d76978fdf44', 1000),
    alt: 'Guests seated at an elegant formal dinner with floral centrepieces',
    fallback: 'from-plum-soft/50 to-plum-deep/60',
  },
}

// Portfolio gallery. tone = fallback gradient; span = bento layout sizing.
export const gallery = [
  {
    title: 'A Kente Wedding',
    cat: 'Wedding',
    src: U('1648328168368-3a25f2152802', 1200),
    tone: 'from-terracotta/30 to-plum/40',
    span: 'md:col-span-2 md:row-span-2',
  },
  {
    title: 'The Exchange of Rings',
    cat: 'Wedding',
    src: U('1742445972540-2f64de4eb4f3', 800),
    tone: 'from-champagne/30 to-plum/30',
    span: '',
  },
  {
    title: 'Brand Launch Gala',
    cat: 'Corporate',
    src: U('1723832348140-a2d9eb1753b1', 800),
    tone: 'from-plum-soft/50 to-plum-deep/60',
    span: '',
  },
  {
    title: 'Outdooring Ceremony',
    cat: 'Celebration',
    src: U('1660675133902-acd1b057f75d', 800),
    tone: 'from-champagne-light/30 to-terracotta/20',
    span: '',
  },
  {
    title: 'The First Dance',
    cat: 'Wedding',
    src: U('1654697605353-553efa78b471', 1200),
    tone: 'from-plum/40 to-champagne/20',
    span: 'md:col-span-2',
  },
  {
    title: 'Candlelit Dinner',
    cat: 'Celebration',
    src: U('1616431629879-af0e95bf9f88', 800),
    tone: 'from-terracotta/30 to-plum-deep/50',
    span: '',
  },
]
