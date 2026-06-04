-- T1.3 Escrow ledger — adds money + escrow state to milestones. Apply once (--remote).
-- (schema.sql carries the same columns in the CREATE for fresh installs.)

ALTER TABLE timeline_events ADD COLUMN amount INTEGER NOT NULL DEFAULT 0;        -- minor units held
ALTER TABLE timeline_events ADD COLUMN currency TEXT NOT NULL DEFAULT 'GHS';
ALTER TABLE timeline_events ADD COLUMN escrow_status TEXT NOT NULL DEFAULT 'none'; -- none|funded|release_requested|released|disputed
ALTER TABLE payments ADD COLUMN milestone_id TEXT;

-- Demo: stage some held funds the client can approve & release.
UPDATE timeline_events SET amount = 1230000, escrow_status = 'released'
  WHERE id = 'demo-tl-1';
UPDATE timeline_events SET amount = 1500000, escrow_status = 'funded'
  WHERE id = 'demo-tl-2';
UPDATE timeline_events SET amount = 1000000, escrow_status = 'funded'
  WHERE id = 'demo-tl-3';
