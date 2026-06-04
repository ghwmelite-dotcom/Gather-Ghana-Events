// Cultural event playbooks — ready-made templates that pre-fill an event's
// schedule, checklist, and budget split. The global scaling unit is a culture,
// not a country. Used by the Playbooks pages and the AI Concierge fallback.

export const playbooks = [
  {
    slug: 'ghanaian-traditional-marriage',
    name: 'Traditional Marriage',
    culture: 'Ghanaian (Akan)',
    summary: 'The knocking (kokooko) and engagement — two families becoming one, with rites, gifts, and joy.',
    palette: ['#2B1B2E', '#C9A24B', '#B5654A', '#1F6B52'],
    fallback: 'from-terracotta/30 to-plum/40',
    schedule: [
      { time: 'Morning', title: 'Kokooko (knocking)', description: "The groom's family formally seeks the bride's hand." },
      { time: 'Midday', title: 'Presentation of items', description: 'The dowry and gift list are presented and reviewed.' },
      { time: 'Afternoon', title: 'Engagement & blessings', description: 'Rings exchanged, elders bless the couple.' },
      { time: 'Evening', title: 'Feast & dancing', description: 'Highlife, food, and celebration with both families.' },
    ],
    checklist: ['Confirm dowry/gift list with both families', 'Linguist (Okyeame) & elders', 'Traditional drinks & schnapps', 'Kente & matching cloth', 'Catering for both families', 'Décor in family colours', 'Photography & videography', 'MC / cultural compère'],
    budget: [
      { label: 'Catering & drinks', pct: 35 },
      { label: 'Décor & venue', pct: 25 },
      { label: 'Gifts & dowry items', pct: 20 },
      { label: 'Photography & film', pct: 12 },
      { label: 'Attire & misc', pct: 8 },
    ],
  },
  {
    slug: 'outdooring',
    name: 'Outdooring (Naming)',
    culture: 'Ghanaian',
    summary: 'Welcoming a new child to family and community with the naming ceremony, blessings, and a warm gathering.',
    palette: ['#FAF6EF', '#C9A24B', '#E4C97E', '#B5654A'],
    fallback: 'from-champagne-light/30 to-terracotta/20',
    schedule: [
      { time: '7:00 AM', title: 'Naming rite', description: 'The elder introduces the child and the chosen name.' },
      { time: '8:00 AM', title: 'Blessings & libation', description: 'Prayers and well-wishes from family.' },
      { time: '9:00 AM', title: 'Breakfast reception', description: 'Light refreshments and gifts for the child.' },
    ],
    checklist: ['Elder / officiant', 'Naming items (water, honey, salt)', 'White & gold décor', 'Light catering / breakfast', 'Keepsake favours', 'Photography'],
    budget: [
      { label: 'Catering', pct: 35 },
      { label: 'Décor', pct: 30 },
      { label: 'Favours & gifts', pct: 20 },
      { label: 'Photography', pct: 15 },
    ],
  },
  {
    slug: 'white-wedding',
    name: 'White Wedding',
    culture: 'Modern',
    summary: 'A classic ceremony and reception — vows, first dance, and an unforgettable party.',
    palette: ['#2B1B2E', '#F5ECD7', '#C9A24B', '#B5654A'],
    fallback: 'from-plum/40 to-champagne/20',
    schedule: [
      { time: '2:00 PM', title: 'Ceremony', description: 'Processional, vows, rings, and the kiss.' },
      { time: '3:30 PM', title: 'Cocktails & photos', description: 'Golden-hour portraits while guests mingle.' },
      { time: '6:00 PM', title: 'Reception', description: 'Dinner, speeches, cake, and first dance.' },
      { time: '8:00 PM', title: 'After-party', description: 'The floor opens — dancing into the night.' },
    ],
    checklist: ['Venue & ceremony permit', 'Officiant', 'Florals & draping', 'Catering & cake', 'DJ / live band', 'Photography & film', 'Bridal party attire', 'Run-of-show & coordinator'],
    budget: [
      { label: 'Venue & catering', pct: 45 },
      { label: 'Décor & florals', pct: 20 },
      { label: 'Photography & film', pct: 15 },
      { label: 'Music & entertainment', pct: 10 },
      { label: 'Attire & beauty', pct: 10 },
    ],
  },
  {
    slug: 'milestone-celebration',
    name: 'Milestone Celebration',
    culture: 'Any',
    summary: 'Birthdays, anniversaries, and special moments — intimate or grand, styled to feel personal.',
    palette: ['#B5654A', '#C9A24B', '#2B1B2E', '#F5ECD7'],
    fallback: 'from-champagne/30 to-terracotta/20',
    schedule: [
      { time: 'Arrival', title: 'Welcome & cocktails', description: 'Guests received with drinks and music.' },
      { time: 'Main', title: 'Toasts & dinner', description: 'Speeches, a shared meal, and the cake moment.' },
      { time: 'Late', title: 'Dancing', description: 'The celebration continues on the floor.' },
    ],
    checklist: ['Theme & styling', 'Venue & décor', 'Catering & cake', 'Entertainment / DJ', 'Photography', 'Favours'],
    budget: [
      { label: 'Venue & catering', pct: 45 },
      { label: 'Décor & theme', pct: 25 },
      { label: 'Entertainment', pct: 15 },
      { label: 'Photography & favours', pct: 15 },
    ],
  },
  {
    slug: 'corporate-gala',
    name: 'Corporate Gala',
    culture: 'Corporate',
    summary: 'Launches, awards, and galas delivered with brand-forward polish and flawless production.',
    palette: ['#1E1320', '#C9A24B', '#3D2A41', '#F5ECD7'],
    fallback: 'from-plum-soft/50 to-plum-deep/60',
    schedule: [
      { time: '6:00 PM', title: 'Registration & networking', description: 'Branded welcome, drinks, and check-in.' },
      { time: '7:00 PM', title: 'Programme', description: 'Speeches, awards, and the keynote.' },
      { time: '8:30 PM', title: 'Dinner & entertainment', description: 'Seated dinner with a live act.' },
      { time: '9:30 PM', title: 'Networking close', description: 'After-drinks and departures.' },
    ],
    checklist: ['Brand-aligned design', 'Venue & AV/production', 'Catering', 'Programme & run-of-show', 'Stage & lighting', 'Photography & film', 'On-site management'],
    budget: [
      { label: 'Venue & production (AV)', pct: 40 },
      { label: 'Catering', pct: 25 },
      { label: 'Stage, lighting & décor', pct: 20 },
      { label: 'Photography & content', pct: 15 },
    ],
  },
]

export const getPlaybook = (slug) => playbooks.find((p) => p.slug === slug)
