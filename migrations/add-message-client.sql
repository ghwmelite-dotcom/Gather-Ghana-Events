-- Link inbound contact-form messages to a known client (nullable; old rows untouched).
-- Apply: wrangler d1 execute gather-ghana --file=./migrations/add-message-client.sql [--remote]
ALTER TABLE messages ADD COLUMN client_id TEXT;
