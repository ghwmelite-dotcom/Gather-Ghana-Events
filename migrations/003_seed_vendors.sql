-- Seed the vendor marketplace. Apply after schema.sql (--remote).
DELETE FROM vendor_reviews WHERE vendor_id LIKE 'v-%';
DELETE FROM vendors WHERE id LIKE 'v-%';

INSERT INTO vendors (id, slug, name, category, location, tagline, about, image, price_from, currency, verified, rating, reviews_count, whatsapp, created_at) VALUES
 ('v-1','accra-royal-caterers','Accra Royal Caterers','catering','Accra','Continental & Ghanaian fine dining','From jollof to canapés, plated or buffet — a kitchen trusted at 200+ weddings.','https://images.unsplash.com/photo-1739295193748-250cca77503a?auto=format&fit=crop&w=800&q=80',800000,'GHS',1,4.9,42,'https://wa.me/233000000001',1717200000),
 ('v-2','kente-and-bloom-decor','Kente & Bloom Décor','decor','Accra','Floral & fabric styling','Lush florals, draping, and kente-accented tablescapes designed around your story.','https://images.unsplash.com/photo-1617813437449-c4f8f233dcd6?auto=format&fit=crop&w=800&q=80',500000,'GHS',1,4.8,31,'https://wa.me/233000000002',1717200000),
 ('v-3','aburi-gardens-venue','Aburi Gardens Venue','venue','Aburi','Garden & hall hire','A botanical garden and elegant hall for ceremonies of 50–400 guests.','https://images.unsplash.com/photo-1723832348140-a2d9eb1753b1?auto=format&fit=crop&w=800&q=80',1200000,'GHS',1,4.7,18,'https://wa.me/233000000003',1717200000),
 ('v-4','golden-hour-photography','Golden Hour Photography','photography','Accra & Kumasi','Weddings & events','Editorial, documentary-style photography and film, capturing the unposed moments.','https://images.unsplash.com/photo-1648328168368-3a25f2152802?auto=format&fit=crop&w=800&q=80',600000,'GHS',1,5.0,57,'https://wa.me/233000000004',1717200000),
 ('v-5','dj-sankofa','DJ Sankofa','music','Accra','Afrobeats, highlife & more','Reading the room from first dance to last — highlife, afrobeats, amapiano, gospel.','https://images.unsplash.com/photo-1654697605353-553efa78b471?auto=format&fit=crop&w=800&q=80',300000,'GHS',1,4.8,39,'https://wa.me/233000000005',1717200000),
 ('v-6','radiance-makeup','Radiance Makeup','makeup','Accra','Bridal & party glam','Long-wear bridal and party makeup for deep, radiant skin — trials included.','https://images.unsplash.com/photo-1618999114008-fbf937170cdb?auto=format&fit=crop&w=800&q=80',150000,'GHS',0,4.6,22,'https://wa.me/233000000006',1717200000);

INSERT INTO vendor_reviews (id, vendor_id, author, rating, body, created_at) VALUES
 ('vr-1','v-1','Ama M.',5,'The food was the talk of the wedding. Flawless service.',1717286400),
 ('vr-2','v-1','Selorm T.',5,'Professional from tasting to clean-up.',1717290000),
 ('vr-3','v-4','Kojo A.',5,'Every photo is a painting. Worth every cedi.',1717293600),
 ('vr-4','v-2','The Owusus',5,'Our venue was transformed. Breathtaking.',1717297200),
 ('vr-5','v-5','Adwoa S.',4,'Kept the floor full all night.',1717300800);
