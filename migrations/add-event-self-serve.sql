-- Self-serve funding pages: mark couple-built event pages.
-- ONE-OFF (ALTER is NOT re-runnable in SQLite — run once on live D1):
--   npx wrangler d1 execute gather-ghana --remote --yes --file=./migrations/add-event-self-serve.sql

ALTER TABLE events ADD COLUMN self_serve INTEGER NOT NULL DEFAULT 0;
