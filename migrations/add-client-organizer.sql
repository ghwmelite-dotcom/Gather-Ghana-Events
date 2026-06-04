-- DB-backed organizer role (config ORGANIZER_EMAILS remains a bootstrap fallback).
-- Apply once: wrangler d1 execute gather-ghana --file=./migrations/add-client-organizer.sql --remote
ALTER TABLE clients ADD COLUMN is_organizer INTEGER NOT NULL DEFAULT 0;
