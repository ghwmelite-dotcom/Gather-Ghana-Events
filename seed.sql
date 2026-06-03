-- Demo data so the client portal has something to show.
-- Apply after schema.sql: wrangler d1 execute gather-ghana --file=./seed.sql [--remote]
-- Then sign in to the portal with: demo@gatherghana.events

DELETE FROM timeline_events WHERE inquiry_id = 'demo-inq';
DELETE FROM payments WHERE inquiry_id = 'demo-inq';
DELETE FROM inquiries WHERE id = 'demo-inq';
DELETE FROM clients WHERE id = 'demo-client';

INSERT INTO clients (id, email, name, phone, created_at)
VALUES ('demo-client', 'demo@gatherghana.events', 'Ama Mensah', '+233241234567', 1717200000);

INSERT INTO inquiries (id, client_id, event_type, event_date, guests, estimate, deposit, notes, status, created_at)
VALUES ('demo-inq', 'demo-client', 'Wedding', '2026-09-12', 180, 41000, 12300,
        'Garden ceremony in Aburi, blush and gold palette.', 'booked', 1717200000);

INSERT INTO payments (id, inquiry_id, client_id, reference, amount, currency, status, channel, purpose, paid_at, created_at)
VALUES
  ('demo-pay-1', 'demo-inq', 'demo-client', 'GGE-DEMO-0001', 1230000, 'GHS', 'success', 'mobile_money', 'deposit', 1717286400, 1717286400);

INSERT INTO timeline_events (id, inquiry_id, title, description, due_date, status, sort, created_at)
VALUES
  ('demo-tl-1', 'demo-inq', 'Deposit received', 'Your date is secured. Thank you!', '2026-06-01', 'done', 1, 1717200000),
  ('demo-tl-2', 'demo-inq', 'Design concept review', 'We present your tailored mood board and plan.', '2026-06-20', 'in_progress', 2, 1717200000),
  ('demo-tl-3', 'demo-inq', 'Vendor confirmations', 'Catering, florals, and venue locked in.', '2026-07-30', 'upcoming', 3, 1717200000),
  ('demo-tl-4', 'demo-inq', 'Final walkthrough', 'Run of show and final details confirmed.', '2026-09-05', 'upcoming', 4, 1717200000),
  ('demo-tl-5', 'demo-inq', 'Event day', 'We run everything so you can be present.', '2026-09-12', 'upcoming', 5, 1717200000);
