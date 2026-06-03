-- Gather Ghana Events — D1 schema
-- Apply: wrangler d1 execute gather-ghana --file=./schema.sql [--remote]

PRAGMA foreign_keys = ON;

-- People who inquire or book.
CREATE TABLE IF NOT EXISTS clients (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  phone       TEXT,
  created_at  INTEGER NOT NULL
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
  id          TEXT PRIMARY KEY,
  inquiry_id  TEXT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  due_date    TEXT,
  status      TEXT NOT NULL DEFAULT 'upcoming', -- upcoming | in_progress | done
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_timeline_inquiry ON timeline_events(inquiry_id);

-- Contact form messages.
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  body        TEXT NOT NULL,
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
