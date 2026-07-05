-- Gather Ghana Events — D1 schema
-- Apply: wrangler d1 execute gather-ghana --file=./schema.sql [--remote]

PRAGMA foreign_keys = ON;

-- People who inquire or book.
CREATE TABLE IF NOT EXISTS clients (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  phone        TEXT,
  is_organizer INTEGER NOT NULL DEFAULT 0,
  role         TEXT NOT NULL DEFAULT 'admin',   -- 'admin' | 'viewer' (only meaningful when is_organizer = 1)
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);

-- Booking requests / events.
CREATE TABLE IF NOT EXISTS inquiries (
  id          TEXT PRIMARY KEY,
  client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  event_date  TEXT,
  guests      INTEGER,
  estimate    INTEGER,             -- GHS (whole cedis)
  deposit     INTEGER,             -- GHS (whole cedis)
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'new',  -- new | quoted | booked | completed | cancelled
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inquiries_client ON inquiries(client_id);

-- Paystack transactions.
CREATE TABLE IF NOT EXISTS payments (
  id          TEXT PRIMARY KEY,
  inquiry_id  TEXT REFERENCES inquiries(id) ON DELETE SET NULL,
  client_id   TEXT REFERENCES clients(id) ON DELETE SET NULL,
  reference   TEXT NOT NULL UNIQUE,
  amount      INTEGER NOT NULL,    -- pesewas (GHS * 100)
  currency    TEXT NOT NULL DEFAULT 'GHS',
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | success | failed
  channel     TEXT,                -- mobile_money | card
  purpose     TEXT DEFAULT 'deposit',
  paid_at     INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference);
CREATE INDEX IF NOT EXISTS idx_payments_inquiry ON payments(inquiry_id);

-- Portal timeline milestones for a booked event.
CREATE TABLE IF NOT EXISTS timeline_events (
  id            TEXT PRIMARY KEY,
  inquiry_id    TEXT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  due_date      TEXT,
  status        TEXT NOT NULL DEFAULT 'upcoming', -- upcoming | in_progress | done
  sort          INTEGER NOT NULL DEFAULT 0,
  amount        INTEGER NOT NULL DEFAULT 0,        -- minor units held in escrow for this milestone
  currency      TEXT NOT NULL DEFAULT 'GHS',
  escrow_status TEXT NOT NULL DEFAULT 'none',      -- none|funded|release_requested|released|disputed
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_timeline_inquiry ON timeline_events(inquiry_id);

-- Contact form messages.
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  body        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'new',   -- new | read | replied
  replied_at  INTEGER,
  created_at  INTEGER NOT NULL
);

-- Single-use magic-link tokens (only the hash is stored).
CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash  TEXT PRIMARY KEY,
  client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tokens_client ON auth_tokens(client_id);

-- =====================================================================
-- Platform Tier 1 — Event Pages, RSVPs, Contribution Pools
-- =====================================================================

-- Shareable public event microsite.
CREATE TABLE IF NOT EXISTS events (
  id                     TEXT PRIMARY KEY,
  slug                   TEXT NOT NULL UNIQUE,
  owner_email            TEXT,                 -- host/creator contact
  inquiry_id             TEXT REFERENCES inquiries(id) ON DELETE SET NULL,
  title                  TEXT NOT NULL,
  host_names             TEXT,
  event_type             TEXT,
  event_date             TEXT,
  start_time             TEXT,
  venue                  TEXT,
  location               TEXT,
  cover_image            TEXT,
  story                  TEXT,
  currency               TEXT NOT NULL DEFAULT 'GHS',
  visibility             TEXT NOT NULL DEFAULT 'public',  -- public | unlisted | private
  rsvp_enabled           INTEGER NOT NULL DEFAULT 1,
  contributions_enabled  INTEGER NOT NULL DEFAULT 1,
  contribution_goal      INTEGER NOT NULL DEFAULT 0,       -- minor units
  livestream_url         TEXT,
  created_at             INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);

CREATE TABLE IF NOT EXISTS event_schedule (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  time        TEXT,
  title       TEXT NOT NULL,
  description TEXT,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_schedule_event ON event_schedule(event_id);

CREATE TABLE IF NOT EXISTS event_gallery (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  caption     TEXT,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gallery_event ON event_gallery(event_id);

CREATE TABLE IF NOT EXISTS rsvps (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  status      TEXT NOT NULL DEFAULT 'yes',   -- yes | no | maybe
  party_size  INTEGER NOT NULL DEFAULT 1,
  message     TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rsvps_event ON rsvps(event_id);

-- Guest contributions to an event's pool (cash registry).
CREATE TABLE IF NOT EXISTS contributions (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name        TEXT,
  email       TEXT,
  amount      INTEGER NOT NULL,              -- minor units
  currency    TEXT NOT NULL DEFAULT 'GHS',
  message     TEXT,
  anonymous   INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | success | failed
  reference   TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contributions_event ON contributions(event_id);
CREATE INDEX IF NOT EXISTS idx_contributions_reference ON contributions(reference);

-- =====================================================================
-- Platform Tier 2 — Vendor Marketplace
-- =====================================================================
CREATE TABLE IF NOT EXISTS vendors (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,                 -- catering | decor | venue | photography | music | cake | makeup
  location    TEXT,
  tagline     TEXT,
  about       TEXT,
  image       TEXT,
  price_from  INTEGER NOT NULL DEFAULT 0,    -- minor units, GHS
  currency    TEXT NOT NULL DEFAULT 'GHS',
  verified    INTEGER NOT NULL DEFAULT 0,
  rating      REAL NOT NULL DEFAULT 0,
  reviews_count INTEGER NOT NULL DEFAULT 0,
  whatsapp    TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors(category);
CREATE INDEX IF NOT EXISTS idx_vendors_slug ON vendors(slug);

CREATE TABLE IF NOT EXISTS vendor_reviews (
  id          TEXT PRIMARY KEY,
  vendor_id   TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  author      TEXT NOT NULL,
  rating      INTEGER NOT NULL,             -- 1..5
  body        TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_vendor ON vendor_reviews(vendor_id);

-- =====================================================================
-- Platform Tier 3 — Organizer OS (proposals)
-- =====================================================================
CREATE TABLE IF NOT EXISTS proposals (
  id            TEXT PRIMARY KEY,
  inquiry_id    TEXT REFERENCES inquiries(id) ON DELETE CASCADE,
  organizer_email TEXT,
  title         TEXT NOT NULL,
  amount        INTEGER NOT NULL DEFAULT 0,  -- minor units
  currency      TEXT NOT NULL DEFAULT 'GHS',
  body          TEXT,
  status        TEXT NOT NULL DEFAULT 'draft', -- draft | sent | accepted | declined
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_proposals_inquiry ON proposals(inquiry_id);

-- =====================================================================
-- Organizer Ops & Books — team tasks, expenses, activity trail
-- =====================================================================

-- Team to-dos, optionally tied to a client's event.
CREATE TABLE IF NOT EXISTS tasks (
  id             TEXT PRIMARY KEY,
  inquiry_id     TEXT REFERENCES inquiries(id) ON DELETE CASCADE,  -- NULL = general task
  title          TEXT NOT NULL,
  notes          TEXT,
  assignee_email TEXT,
  due_date       TEXT,
  status         TEXT NOT NULL DEFAULT 'open',   -- open | in_progress | done
  created_by     TEXT,
  completed_at   INTEGER,
  created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_inquiry ON tasks(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status  ON tasks(status);

-- Cost lines per event (or general overhead). planned+committed lines ARE the budget.
CREATE TABLE IF NOT EXISTS expenses (
  id          TEXT PRIMARY KEY,
  inquiry_id  TEXT REFERENCES inquiries(id) ON DELETE CASCADE,  -- NULL = general/overhead
  vendor_name TEXT,
  category    TEXT NOT NULL DEFAULT 'misc',
  description TEXT,
  amount      INTEGER NOT NULL,                 -- minor units (pesewas)
  currency    TEXT NOT NULL DEFAULT 'GHS',
  status      TEXT NOT NULL DEFAULT 'planned',  -- planned | committed | paid
  paid_at     INTEGER,
  receipt_url TEXT,
  created_by  TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_expenses_inquiry ON expenses(inquiry_id);

-- Who did what, when — written best-effort by every org/portal mutation.
CREATE TABLE IF NOT EXISTS activity_log (
  id          TEXT PRIMARY KEY,
  actor_email TEXT,
  action      TEXT NOT NULL,        -- e.g. inquiry.status, task.create, expense.paid
  entity_type TEXT,
  entity_id   TEXT,
  inquiry_id  TEXT,                 -- when related to a client/event, for filtering
  detail      TEXT,                 -- human-readable summary line
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_inquiry ON activity_log(inquiry_id);

-- =====================================================================
-- Client Messaging — persistent inbox replies + organizer<->client threads
-- =====================================================================

-- Replies the organizer sends from the inbox (full history, emailed via Resend).
CREATE TABLE IF NOT EXISTS message_replies (
  id           TEXT PRIMARY KEY,
  message_id   TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  author_email TEXT,
  body         TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_replies_message ON message_replies(message_id);

-- Organizer<->client conversation, one thread per inquiry (event).
CREATE TABLE IF NOT EXISTS thread_messages (
  id             TEXT PRIMARY KEY,
  inquiry_id     TEXT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  sender_role    TEXT NOT NULL,              -- organizer | client
  sender_email   TEXT,
  body           TEXT NOT NULL,
  read_by_org    INTEGER NOT NULL DEFAULT 0, -- a message is born read by its sender
  read_by_client INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_thread_inquiry ON thread_messages(inquiry_id);

-- Services catalog (admin-editable offerings shown on /services).
CREATE TABLE IF NOT EXISTS services (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  tagline     TEXT,
  description TEXT,
  image       TEXT,
  features    TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  price_from  INTEGER NOT NULL DEFAULT 0,   -- whole GH₵
  featured    INTEGER NOT NULL DEFAULT 0,
  published   INTEGER NOT NULL DEFAULT 1,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_services_published ON services(published, sort);

-- Editable page content: process steps, FAQ, testimonials (admin-managed).
CREATE TABLE IF NOT EXISTS site_content (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,               -- process | faq | testimonial
  data       TEXT NOT NULL DEFAULT '{}',   -- JSON object, shape per type
  sort       INTEGER NOT NULL DEFAULT 0,
  published  INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_site_content ON site_content(type, published, sort);
