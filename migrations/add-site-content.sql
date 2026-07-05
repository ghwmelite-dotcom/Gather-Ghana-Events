-- site_content table + seed of current Process/FAQ/testimonials. Idempotent (fixed ids + INSERT OR IGNORE).
-- Apply to live D1:
--   npx wrangler d1 execute gather-ghana --remote --file=./migrations/add-site-content.sql

CREATE TABLE IF NOT EXISTS site_content (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,
  data       TEXT NOT NULL DEFAULT '{}',
  sort       INTEGER NOT NULL DEFAULT 0,
  published  INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_site_content ON site_content(type, published, sort);

INSERT OR IGNORE INTO site_content (id, type, data, sort, published, created_at) VALUES
('sc_process_1', 'process', '{"title":"Discover","desc":"We listen to your vision, date, and budget, then shape the brief together."}', 1, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('sc_process_2', 'process', '{"title":"Design","desc":"A tailored concept, mood, and plan, presented for your review and refinement."}', 2, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('sc_process_3', 'process', '{"title":"Coordinate","desc":"We source and manage every vendor and detail, keeping you informed throughout."}', 3, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('sc_process_4', 'process', '{"title":"Deliver","desc":"On the day, we run everything seamlessly so you can simply enjoy the moment."}', 4, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('sc_faq_1', 'faq', '{"q":"How far in advance should we book?","a":"For weddings and large events we recommend 6–12 months. For intimate celebrations, 2–3 months is often enough. That said, we occasionally take on shorter timelines — reach out and we will tell you honestly what is possible."}', 1, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('sc_faq_2', 'faq', '{"q":"Do you work within a set budget?","a":"Always. We design around your budget rather than against it, and we steward it carefully throughout — sourcing vendors, tracking spend, and flagging trade-offs early so there are no surprises."}', 2, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('sc_faq_3', 'faq', '{"q":"What areas do you serve?","a":"We are based in Accra and work across Ghana. For destination events elsewhere, travel and accommodation are quoted separately."}', 3, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('sc_faq_4', 'faq', '{"q":"How do payments and deposits work?","a":"A 30% deposit secures your date. Payments are processed securely via Paystack — Mobile Money (MTN, Vodafone, AirtelTigo) and card. The balance is split across agreed milestones, all visible in your client portal."}', 4, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('sc_faq_5', 'faq', '{"q":"Can we just hire you for day-of coordination?","a":"Yes. While many clients choose full planning and styling, we also offer styling-only and day-of coordination packages. Tell us where you are and we will shape the right scope."}', 5, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('sc_testimonial_1', 'testimonial', '{"quote":"They carried every detail so we could simply be present. Our guests still talk about how seamless and beautiful the day felt.","name":"Ama & Kojo","event":"Garden Wedding, Aburi"}', 1, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('sc_testimonial_2', 'testimonial', '{"quote":"Calm, organised, and genuinely creative. Gather turned a corporate launch into something our whole company felt proud of.","name":"Selorm Tetteh","event":"Brand Launch, Accra"}', 2, 1, CAST(strftime('%s','now') AS INTEGER) * 1000),
('sc_testimonial_3', 'testimonial', '{"quote":"From the first conversation it felt personal. They listened, then designed a celebration that was unmistakably ours.","name":"The Mensah Family","event":"50th Anniversary"}', 3, 1, CAST(strftime('%s','now') AS INTEGER) * 1000);
