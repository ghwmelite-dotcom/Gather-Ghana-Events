// Content for the public /guide page. Edit the copy here — the page renders from this.
// Each group: { id, label, blurb, sections }. Each section: { id, icon, title, intro, steps?, note? }.
// `icon` must be an export name from src/lib/icons.jsx.

export const GUIDE_GROUPS = [
  {
    id: 'organizers',
    label: 'For organizers',
    blurb: 'Run the business — leads, proposals, escrow, vendors, and your team.',
    sections: [
      {
        id: 'org-signin', icon: 'Lock', title: 'Signing in & access',
        intro: 'Gather Ghana is passwordless — you sign in with a secure link sent to your email.',
        steps: [
          'Go to the Sign in page and enter your email.',
          'Open the email from us and tap “Open my portal”. The link lasts 30 minutes and works once.',
          'Organizers land on the dashboard; everyone else lands on their client portal.',
        ],
        note: 'Organizer access is granted from the Team page (below) or set by the studio.',
      },
      {
        id: 'org-leads', icon: 'Users', title: 'Leads & proposals',
        intro: 'Every booking enquiry becomes a lead on your dashboard.',
        steps: [
          'Open a lead to see the couple, event, estimate and brief.',
          'Send a proposal — a titled quote with an amount — from the lead or the client page.',
          'The client reviews it in their portal and accepts or declines.',
        ],
      },
      {
        id: 'org-escrow', icon: 'Lock', title: 'Milestones & the Gather Guarantee',
        intro: 'Milestones break the work into stages; escrow protects the money behind each one.',
        steps: [
          'On a client’s page, add a milestone with a title, due date and amount.',
          'Mark it Funded once payment is in, then Request release when the stage is done.',
          'The client taps Approve & release to pay it out — funds are held until they do.',
        ],
        note: 'That hold-until-approved promise is the “Gather Guarantee”.',
      },
      {
        id: 'org-vendors', icon: 'Building', title: 'Vendors',
        intro: 'Curate the marketplace couples browse at /vendors.',
        steps: [
          'Open Vendors from the dashboard to add, edit or remove a vendor.',
          'Toggle Verified on the vendors you trust — verified vendors appear first publicly.',
        ],
      },
      {
        id: 'org-inbox', icon: 'Mail', title: 'Inbox',
        intro: 'Messages from the contact form land in your inbox.',
        steps: [
          'Open Inbox and tap a message to read it — opening it marks it as read.',
          'Write a reply and send; it’s emailed to the sender and the message is marked replied.',
        ],
      },
      {
        id: 'org-team', icon: 'Users', title: 'Team',
        intro: 'Decide who can access the organizer portal.',
        steps: [
          'Open Team and invite an organizer by email — they receive a sign-in link.',
          'Revoke access any time. Core organizers set by the studio are permanent.',
        ],
      },
      {
        id: 'org-events', icon: 'Calendar', title: 'Event pages',
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
        id: 'cl-signin', icon: 'Lock', title: 'Signing in to your portal',
        intro: 'No password needed — we email you a secure sign-in link.',
        steps: [
          'Go to the Sign in page and enter the email you booked with.',
          'Open our email and tap the link to enter your portal.',
        ],
      },
      {
        id: 'cl-timeline', icon: 'CreditCard', title: 'Your timeline & payments',
        intro: 'Your portal shows your event, planning timeline and money in one place.',
        steps: [
          'Follow each milestone as your planner moves it forward.',
          'See your estimate, paid-to-date and balance; pay the balance securely by Mobile Money or card.',
        ],
      },
      {
        id: 'cl-proposals', icon: 'CheckCircle', title: 'Proposals',
        intro: 'When your planner sends a quote, it appears in your portal.',
        steps: [
          'Read the proposal and its amount.',
          'Tap Accept to move forward, or Decline.',
        ],
      },
      {
        id: 'cl-escrow', icon: 'Lock', title: 'Approving escrow releases',
        intro: 'Your payments are held safely until you’re happy.',
        steps: [
          'When a milestone is funded and release is requested, you’ll see Approve & release.',
          'Approve once the stage is done — your money is protected until then.',
        ],
      },
      {
        id: 'cl-events', icon: 'Heart', title: 'Event pages, RSVPs & gifts',
        intro: 'Your event page lets guests celebrate with you.',
        steps: [
          'Share your /e/ link so guests can RSVP and see the schedule.',
          'Guests can contribute to your gift pool; amounts can show in their currency and settle in GHS.',
        ],
      },
      {
        id: 'cl-financing', icon: 'Clock', title: 'Plan now, pay over time',
        intro: 'Spread the cost with a deposit and instalments.',
        steps: [
          'On the Book page, use the estimate widget to see a deposit (about 30%) plus monthly instalments.',
        ],
      },
    ],
  },
]
