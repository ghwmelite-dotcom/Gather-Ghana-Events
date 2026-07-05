-- Fund-my-Event: fundable line items + per-contribution line tag + saved quote.
-- ONE-OFF (ALTERs are NOT re-runnable in SQLite — run once on live D1):
--   npx wrangler d1 execute gather-ghana --remote --yes --file=./migrations/add-event-funding.sql

CREATE TABLE IF NOT EXISTS event_line_items (
  id              TEXT PRIMARY KEY,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  category_key    TEXT,
  target_amount   INTEGER NOT NULL DEFAULT 0,
  sort            INTEGER NOT NULL DEFAULT 0,
  visible         INTEGER NOT NULL DEFAULT 1,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_line_items_event ON event_line_items(event_id, visible, sort);

ALTER TABLE contributions ADD COLUMN line_item_id TEXT REFERENCES event_line_items(id) ON DELETE SET NULL;
ALTER TABLE inquiries ADD COLUMN quote_json TEXT;
