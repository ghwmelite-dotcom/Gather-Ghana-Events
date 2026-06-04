-- Organizer/admin account. A client row is required before magic-link sign-in
-- works (auth/request only mails KNOWN emails); being on ORGANIZER_EMAILS in
-- wrangler.toml then grants access to /org.
--
-- Apply to the LIVE D1:
--   npx wrangler d1 execute gather-ghana --file=./seed-admin.sql --remote
-- INSERT OR IGNORE makes it safe to re-run (email is UNIQUE).

INSERT OR IGNORE INTO clients (id, email, name, phone, created_at)
VALUES ('admin-ohwp', 'ohwpstudios@gmail.com', 'OHWP Studios', NULL,
        CAST(strftime('%s','now') AS INTEGER) * 1000);
