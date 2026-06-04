-- Demo event for the public Event Page. Apply after schema.sql (--remote).
-- Visit: /e/ama-and-kojo

DELETE FROM contributions WHERE event_id = 'demo-evt';
DELETE FROM rsvps WHERE event_id = 'demo-evt';
DELETE FROM event_schedule WHERE event_id = 'demo-evt';
DELETE FROM events WHERE id = 'demo-evt';

INSERT INTO events
  (id, slug, owner_email, inquiry_id, title, host_names, event_type, event_date, start_time,
   venue, location, cover_image, story, currency, visibility, rsvp_enabled,
   contributions_enabled, contribution_goal, livestream_url, created_at)
VALUES
  ('demo-evt', 'ama-and-kojo', 'demo@gatherghana.events', 'demo-inq',
   'The Wedding of Ama & Kojo', 'Ama & Kojo', 'Wedding', '2026-09-12', '2:00 PM',
   'Aburi Botanical Gardens', 'Aburi, Ghana',
   'https://images.unsplash.com/photo-1695281536457-01f9a07c575b?auto=format&fit=crop&w=1920&q=80',
   'Two families, one beautiful beginning. Join us under the trees in Aburi as we say "I do" — Ghanaian rites in the morning, celebration into the night.',
   'GHS', 'public', 1, 1, 2000000, NULL, 1717200000);

INSERT INTO event_schedule (id, event_id, time, title, description, sort, created_at) VALUES
  ('se1','demo-evt','9:00 AM','Traditional rites','The knocking and engagement, with both families.','1',1717200000),
  ('se2','demo-evt','2:00 PM','Wedding ceremony','Vows under the trees at Aburi Botanical Gardens.','2',1717200000),
  ('se3','demo-evt','4:00 PM','Cocktails & photos','Champagne, kente, and golden-hour portraits.','3',1717200000),
  ('se4','demo-evt','7:00 PM','Reception & dancing','Dinner, speeches, and dancing into the night.','4',1717200000);

INSERT INTO contributions (id, event_id, name, email, amount, currency, message, anonymous, status, reference, created_at) VALUES
  ('dc1','demo-evt','Auntie Akosua','a@example.com',100000,'GHS','So proud of you both. Medaase for letting us share this day!',0,'success','GGC-DEMO-1',1717286400),
  ('dc2','demo-evt','The Owusu Family','o@example.com',50000,'GHS','Wishing you a lifetime of joy.',0,'success','GGC-DEMO-2',1717290000),
  ('dc3','demo-evt',NULL,'x@example.com',25000,'GHS','Congratulations!',1,'success','GGC-DEMO-3',1717293600);

INSERT INTO rsvps (id, event_id, name, email, phone, status, party_size, message, created_at) VALUES
  ('dr1','demo-evt','Kwesi Boateng','k@example.com',NULL,'yes',2,'Wouldn''t miss it!',1717290000),
  ('dr2','demo-evt','Adwoa Sarpong','a2@example.com',NULL,'yes',1,NULL,1717293600),
  ('dr3','demo-evt','Yaw Darko','y@example.com',NULL,'yes',4,'Bringing the whole crew.',1717297200);
