// Content for the public /guide page. Edit the copy here — the page renders from this.
// Each group: { id, label, blurb, sections }. Each section: { id, icon, title, intro, steps?, note?, roles }.
// `icon` must be an export name from src/lib/icons.jsx.
// `roles` lists who the section is useful to: 'admin' (full organizer), 'viewer' (read-only
// organizer), 'client'. The dashboard and /guide use it to show each role only what's relevant.

export const GUIDE_OVERVIEW = {
  id: 'overview',
  title: 'What is Gather Ghana?',
  lead: [
    'Gather Ghana Events is an all-in-one platform for planning, paying for, and celebrating Ghanaian weddings and events — from the very first enquiry to the last dance. It brings the planner, the couple, and the guests together in one warm, trusted space.',
    'Couples plan alongside their organizer in a private portal, pay securely by Mobile Money or card, and stay in control with escrow that releases only when they approve each stage. Guests — at home or across the diaspora — RSVP and send gifts through a beautiful event page. And planners run the entire business from a single dashboard.',
  ],
  highlights: [
    { icon: 'Users', title: 'Plan with a pro', text: 'Book a planner and follow every detail in your private client portal.' },
    { icon: 'Lock', title: 'The Gather Guarantee', text: 'Payments sit safely in escrow and release only when you approve each milestone.' },
    { icon: 'Calendar', title: 'Beautiful event pages', text: 'A shareable page per celebration with schedule, gallery and RSVPs.' },
    { icon: 'Heart', title: 'Gifts from everyone', text: 'Guests near and far contribute to your gift pool.' },
    { icon: 'CreditCard', title: 'Built for the diaspora', text: 'Loved ones abroad give in their own currency; you’re settled in GHS.' },
    { icon: 'Building', title: 'Verified vendors', text: 'Discover and book trusted vendors in the marketplace.' },
    { icon: 'Sparkles', title: 'Akwaaba AI & playbooks', text: 'An AI concierge and Ghanaian cultural playbooks guide the planning.' },
    { icon: 'Clock', title: 'Plan now, pay over time', text: 'Spread the cost with a deposit and gentle instalments.' },
  ],
  closing: 'Below, jump into the details — whether you’re running events as an organizer or planning your own celebration.',
}

export const GUIDE_GROUPS = [
  {
    id: 'organizers',
    label: 'For organizers',
    blurb: 'Run the business — leads, proposals, escrow, vendors, and your team.',
    sections: [
      {
        id: 'org-signin', icon: 'Lock', title: 'Signing in & access', roles: ['admin', 'viewer'],
        intro: 'Gather Ghana is passwordless — you sign in with a secure link sent to your email.',
        steps: [
          'Go to the Sign in page and enter your email.',
          'Open the email from us and tap “Open my portal”. The link lasts 30 minutes and works once.',
          'Organizers land on the dashboard; everyone else lands on their client portal.',
        ],
        note: 'Organizer access is granted from the Team page (below) or set by the studio.',
      },
      {
        id: 'org-leads', icon: 'Users', title: 'Leads & proposals', roles: ['admin', 'viewer'],
        intro: 'Every booking enquiry becomes a lead on your dashboard.',
        steps: [
          'Open a lead to see the couple, event, estimate and brief.',
          'Send a proposal — a titled quote with an amount — from the lead or the client page.',
          'The client reviews it in their portal and accepts or declines.',
        ],
        note: 'View-only team members can read every lead and proposal, but only full organizers can send them.',
      },
      {
        id: 'org-escrow', icon: 'Lock', title: 'Milestones & the Gather Guarantee', roles: ['admin', 'viewer'],
        intro: 'Milestones break the work into stages; escrow protects the money behind each one.',
        steps: [
          'On a client’s page, add a milestone with a title, due date and amount.',
          'Mark it Funded once payment is in, then Request release when the stage is done.',
          'The client taps Approve & release to pay it out — funds are held until they do.',
        ],
        note: 'That hold-until-approved promise is the “Gather Guarantee”.',
      },
      {
        id: 'org-vendors', icon: 'Building', title: 'Vendors', roles: ['admin'],
        intro: 'Curate the marketplace couples browse at /vendors.',
        steps: [
          'Open Vendors from the dashboard to add, edit or remove a vendor.',
          'Toggle Verified on the vendors you trust — verified vendors appear first publicly.',
        ],
      },
      {
        id: 'org-inbox', icon: 'Mail', title: 'Inbox', roles: ['admin'],
        intro: 'Messages from the contact form land in your inbox.',
        steps: [
          'Open Inbox and tap a message to read it — opening it marks it as read.',
          'Write a reply and send; it’s emailed to the sender and kept in the inbox history.',
          'Messages from existing clients carry an “Existing client” link to their page.',
        ],
      },
      {
        id: 'org-thread', icon: 'Mail', title: 'Messages with clients', roles: ['admin', 'viewer'],
        intro: 'Every event has its own conversation, kept with the record.',
        steps: [
          'On a client’s page, write in the Messages card — the client gets an email and sees it in their portal.',
          'Client replies show an unread badge on the lead in your dashboard.',
          'Opening the client page marks the conversation read.',
        ],
      },
      {
        id: 'org-team', icon: 'Users', title: 'Team & roles', roles: ['admin'],
        intro: 'Decide who can access the organizer portal, and at what level.',
        steps: [
          'Open Team and invite an organizer by email — they receive a sign-in link.',
          'Choose a role: full organizers can edit everything; view-only members can see the whole operation but make no changes.',
          'Revoke access any time. Core organizers set by the studio are permanent.',
        ],
        note: 'Give bookkeepers, assistants or stakeholders a view-only seat when they need visibility, not control.',
      },
      {
        id: 'org-tasks', icon: 'CheckCircle', title: 'Team tasks', roles: ['admin', 'viewer'],
        intro: 'Stop juggling lists — assign the work and watch it move.',
        steps: [
          'Open Tasks from the dashboard, or add tasks right on a client’s page.',
          'Give each task an owner and a due date — overdue ones are flagged.',
          'Tap the circle to move a task from open to in-progress to done.',
        ],
        note: 'Every change is recorded in the activity trail, so you always know who did what.',
      },
      {
        id: 'org-books', icon: 'CreditCard', title: 'Financials — costs, budgets & margins', roles: ['admin', 'viewer'],
        intro: 'The money picture across every event, without a spreadsheet.',
        steps: [
          'Record cost lines (venue, catering, decor…) on a client’s page or in Financials.',
          'Move each line planned → committed → paid as it happens — planned and committed lines are your budget.',
          'Financials shows collected, outstanding, costs and margin per event and overall.',
          'Export Events, Payments or Expenses as CSV any time for your accountant.',
        ],
        note: 'View-only members can read every figure and export the CSVs, ideal for an accountant.',
      },
      {
        id: 'org-events', icon: 'Calendar', title: 'Event pages', roles: ['admin'],
        intro: 'Give each celebration a beautiful public page.',
        steps: [
          'Create an event page from the dashboard with the couple, date and details.',
          'Share the /e/ link — guests can RSVP, view the schedule and send gifts.',
        ],
      },
    ],
  },
  {
    id: 'clients',
    label: 'For clients & guests',
    blurb: 'Plan your celebration, track payments, and let loved ones be part of it.',
    sections: [
      {
        id: 'cl-signin', icon: 'Lock', title: 'Signing in to your portal', roles: ['client'],
        intro: 'No password needed — we email you a secure sign-in link.',
        steps: [
          'Go to the Sign in page and enter the email you booked with.',
          'Open our email and tap the link to enter your portal.',
        ],
      },
      {
        id: 'cl-timeline', icon: 'CreditCard', title: 'Your timeline & payments', roles: ['client'],
        intro: 'Your portal shows your event, planning timeline and money in one place.',
        steps: [
          'Follow each milestone as your planner moves it forward.',
          'See your estimate, paid-to-date and balance; pay the balance securely by Mobile Money or card.',
        ],
      },
      {
        id: 'cl-proposals', icon: 'CheckCircle', title: 'Proposals', roles: ['client'],
        intro: 'When your planner sends a quote, it appears in your portal.',
        steps: [
          'Read the proposal and its amount.',
          'Tap Accept to move forward, or Decline.',
        ],
      },
      {
        id: 'cl-escrow', icon: 'Lock', title: 'Approving escrow releases', roles: ['client'],
        intro: 'Your payments are held safely until you’re happy.',
        steps: [
          'When a milestone is funded and release is requested, you’ll see Approve & release.',
          'Approve once the stage is done — your money is protected until then.',
        ],
      },
      {
        id: 'cl-messages', icon: 'Mail', title: 'Messaging your planner', roles: ['client'],
        intro: 'Talk to your planner without leaving your portal.',
        steps: [
          'Open the Messages card in your portal and write your message.',
          'Your planner is emailed instantly and replies appear right there.',
        ],
        note: 'The whole conversation stays with your event — nothing gets lost in chat apps.',
      },
      {
        id: 'cl-events', icon: 'Heart', title: 'Event pages, RSVPs & gifts', roles: ['client'],
        intro: 'Your event page lets guests celebrate with you.',
        steps: [
          'Share your /e/ link so guests can RSVP and see the schedule.',
          'Guests can contribute to your gift pool; amounts can show in their currency and settle in GHS.',
        ],
      },
      {
        id: 'cl-financing', icon: 'Clock', title: 'Plan now, pay over time', roles: ['client'],
        intro: 'Spread the cost with a deposit and instalments.',
        steps: [
          'On the Book page, use the estimate widget to see a deposit (about 30%) plus monthly instalments.',
        ],
      },
    ],
  },
]

// Signed-in roles the guide can tailor itself to. `admin` = full organizer, `viewer` =
// read-only organizer, `client` = a couple using their portal.
export const GUIDE_ROLES = [
  { id: 'admin', label: 'Organizer', hero: 'Run the whole business — leads, escrow, financials, your team and more.' },
  { id: 'viewer', label: 'View-only', hero: 'See the whole operation at a glance. Changes are made by full organizers.' },
  { id: 'client', label: 'Client', hero: 'Plan your celebration, track every payment, and bring loved ones in.' },
]

const ROLE_IDS = GUIDE_ROLES.map((r) => r.id)

// Every section, flattened in guide order, tagged with its parent group.
const ALL_SECTIONS = GUIDE_GROUPS.flatMap((g) =>
  g.sections.map((s) => ({ ...s, groupId: g.id, groupLabel: g.label }))
)

/** Flat list of guide sections useful to a role (in guide order). Unknown/empty role → all. */
export function sectionsForRole(role) {
  if (!ROLE_IDS.includes(role)) return ALL_SECTIONS
  return ALL_SECTIONS.filter((s) => (s.roles || []).includes(role))
}

/** GUIDE_GROUPS pruned to a role — sections and empty groups are dropped. Unknown/empty role → all. */
export function groupsForRole(role) {
  if (!ROLE_IDS.includes(role)) return GUIDE_GROUPS
  return GUIDE_GROUPS
    .map((g) => ({ ...g, sections: g.sections.filter((s) => (s.roles || []).includes(role)) }))
    .filter((g) => g.sections.length > 0)
}
