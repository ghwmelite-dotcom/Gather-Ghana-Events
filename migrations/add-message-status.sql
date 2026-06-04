-- Adds inbox status + replied timestamp to contact messages.
-- Apply once: wrangler d1 execute gather-ghana --file=./migrations/add-message-status.sql --remote
ALTER TABLE messages ADD COLUMN status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE messages ADD COLUMN replied_at INTEGER;
