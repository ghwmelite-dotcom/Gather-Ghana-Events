-- Services catalog + seed of the original three offerings. Idempotent (fixed ids + INSERT OR IGNORE).
-- Apply to live D1:
--   npx wrangler d1 execute gather-ghana --remote --file=./migrations/add-services.sql

CREATE TABLE IF NOT EXISTS services (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  tagline     TEXT,
  description TEXT,
  image       TEXT,
  features    TEXT NOT NULL DEFAULT '[]',
  price_from  INTEGER NOT NULL DEFAULT 0,
  featured    INTEGER NOT NULL DEFAULT 0,
  published   INTEGER NOT NULL DEFAULT 1,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_services_published ON services(published, sort);

INSERT OR IGNORE INTO services (id, name, tagline, description, image, features, price_from, featured, published, sort, created_at) VALUES
('svc_weddings', 'Weddings', 'Full planning, design & day-of coordination',
 'Full-service planning and styling for traditional rites, engagements, and white weddings alike — honouring custom and personality in equal measure. We coordinate vendors, design the aesthetic, and run the day so you and your family can be fully present.',
 'https://images.unsplash.com/photo-1661332517932-2d441bfb2994?auto=format&fit=crop&w=1000&q=80',
 '["Concept & design direction","Vendor sourcing & management","Full day-of coordination","Budget stewardship","Dedicated lead planner"]',
 35000, 1, 1, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('svc_celebrations', 'Celebrations', 'Birthdays, anniversaries & milestones',
 'Birthdays, anniversaries, outdoorings (naming ceremonies), engagements, and milestones. Intimate or grand, every celebration is styled to feel personal, warm, and unmistakably yours.',
 'https://images.unsplash.com/photo-1618999114008-fbf937170cdb?auto=format&fit=crop&w=1000&q=80',
 '["Theme & styling","Venue & décor sourcing","Entertainment booking","Guest experience design","On-the-day management"]',
 18000, 0, 1, 2, CAST(strftime('%s','now') AS INTEGER) * 1000),
('svc_corporate', 'Corporate', 'Launches, galas & conferences',
 'Product launches, galas, conferences, and brand activations delivered with the polish your organisation expects — and measured against the outcomes that matter to you.',
 'https://images.unsplash.com/photo-1768508950719-4d76978fdf44?auto=format&fit=crop&w=1000&q=80',
 '["Brand-aligned design","Logistics & production","AV & technical direction","On-site management","Post-event reporting"]',
 25000, 0, 1, 3, CAST(strftime('%s','now') AS INTEGER) * 1000);
