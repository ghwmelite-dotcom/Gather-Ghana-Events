// Centralized marketing content. Edit copy here; pages stay presentational.

export const testimonials = [
  {
    quote:
      'They carried every detail so we could simply be present. Our guests still talk about how seamless and beautiful the day felt.',
    name: 'Ama & Kojo',
    event: 'Garden Wedding, Aburi',
  },
  {
    quote:
      'Calm, organised, and genuinely creative. Gather turned a corporate launch into something our whole company felt proud of.',
    name: 'Selorm Tetteh',
    event: 'Brand Launch, Accra',
  },
  {
    quote:
      'From the first conversation it felt personal. They listened, then designed a celebration that was unmistakably ours.',
    name: 'The Mensah Family',
    event: '50th Anniversary',
  },
]

export const faqs = [
  {
    q: 'How far in advance should we book?',
    a: 'For weddings and large events we recommend 6–12 months. For intimate celebrations, 2–3 months is often enough. That said, we occasionally take on shorter timelines — reach out and we will tell you honestly what is possible.',
  },
  {
    q: 'Do you work within a set budget?',
    a: 'Always. We design around your budget rather than against it, and we steward it carefully throughout — sourcing vendors, tracking spend, and flagging trade-offs early so there are no surprises.',
  },
  {
    q: 'What areas do you serve?',
    a: 'We are based in Accra and work across Ghana. For destination events elsewhere, travel and accommodation are quoted separately.',
  },
  {
    q: 'How do payments and deposits work?',
    a: 'A 30% deposit secures your date. Payments are processed securely via Paystack — Mobile Money (MTN, Vodafone, AirtelTigo) and card. The balance is split across agreed milestones, all visible in your client portal.',
  },
  {
    q: 'Can we just hire you for day-of coordination?',
    a: 'Yes. While many clients choose full planning and styling, we also offer styling-only and day-of coordination packages. Tell us where you are and we will shape the right scope.',
  },
]


export const fmtGhs = (n) => 'GH₵ ' + Math.round(n).toLocaleString('en-GH')
