-- Local development sample data. Placeholder products only — real products
-- will be entered through the admin panel. Prices in AUD cents, GST-inclusive.
-- Run: pnpm db:seed:local   (or pnpm db:reset:local to wipe + migrate + seed)
--
-- Dev logins (local only; never use these hashes anywhere real):
--   admin@novap.local     / novap-admin-dev      (role admin)
--   customer@novap.local  / novap-customer-dev   (role customer)
-- Hashes made with: node scripts/hash-password.mjs "<password>"

INSERT INTO users (id, email, name, password_hash, role) VALUES
  (1, 'admin@novap.local', 'Dev Admin', 'pbkdf2$100000$sJ0DJwn/GP+qjCBuMy07Ug==$BP2VcMzh/tpqiWUovL2Rgsbbtx3VjHdZdbQWJzmudYQ=', 'admin'),
  (2, 'customer@novap.local', 'Dev Customer', 'pbkdf2$100000$4BV+q6o0VcfXSWIhw/tzXA==$yy7K9DCpl6l1Hf0W26NOBWPV2TwkJgaOS6knqSBqYbc=', 'customer');

INSERT INTO categories (id, name, slug, sort_order) VALUES
  (1, 'Collection', 'collection', 1),
  (2, 'Accessories', 'accessories', 2);

INSERT INTO products (id, slug, name, subtitle, description, category_id, featured) VALUES
  (1, 'reference-01', 'Reference 01', 'Pearl / Titanium', 'Placeholder product for development.', 1, 1),
  (2, 'reference-02', 'Reference 02', 'Obsidian / Silver', 'Placeholder product for development.', 1, 1),
  (3, 'reference-03', 'Reference 03', 'Stone / Silver', 'Placeholder product for development.', 1, 0),
  (4, 'reference-04', 'Reference 04', 'Champagne / Onyx', 'Placeholder product for development.', 1, 0),
  (5, 'storage-case', 'Storage Case', 'Matte black', 'Placeholder accessory for development.', 2, 0);

INSERT INTO variants (product_id, sku, label, price_cents, compare_at_cents, stock, attributes, sort_order) VALUES
  (1, 'REF01-S', 'Small', 4995, NULL, 25, '{"size":"small"}', 1),
  (1, 'REF01-L', 'Large', 8995, NULL, 10, '{"size":"large"}', 2),
  (2, 'REF02-S', 'Small', 5495, 6495, 30, '{"size":"small"}', 1),
  (2, 'REF02-L', 'Large', 9495, NULL, 0, '{"size":"large"}', 2),
  (3, 'REF03-S', 'Small', 3995, NULL, 15, '{"size":"small"}', 1),
  (4, 'REF04-S', 'Small', 6995, NULL, 8, '{"size":"small"}', 1),
  (5, 'CASE-BLK', 'Standard', 2495, NULL, 50, '{"colour":"black"}', 1);

-- Contact inbox: one message per status. Times are offsets from now so "newest first" is predictable.
INSERT INTO contact_messages (name, email, subject, message, status, created_at) VALUES
  ('Alex Citizen', 'alex@example.com', 'Question about Reference 02', 'Hi, is the Large size coming back in stock soon?', 'new', unixepoch() - 3600),
  ('Sam Lee', 'sam@example.com', 'Shipping to Perth', 'How long does delivery to WA usually take?', 'read', unixepoch() - 86400),
  ('Jo Park', 'jo@example.com', 'Order arrived', 'Just letting you know my order arrived safely. Thanks!', 'archived', unixepoch() - 172800);

-- Orders: one per status, for the admin order list. Totals follow checkout's rules: flat $9.95 shipping
-- under $150, GST = round(total / 11). Stripe ids are fake, so these can't be looked up in Stripe.
-- The pending order has no Stripe session, so nothing will ever expire it; it only shows up with ?status=pending.
INSERT INTO orders (id, user_id, email, status, subtotal_cents, shipping_cents, gst_cents, total_cents, shipping_address, stripe_session_id, stripe_payment_intent_id, paid_at, fulfilled_at, tracking_number, created_at) VALUES
  (1, NULL, 'alex@example.com', 'paid', 7490, 995, 771, 8485,
   '{"name":"Alex Citizen","line1":"1 Test Street","line2":null,"city":"Sydney","state":"NSW","postcode":"2000","country":"AU","phone":"+61400000001"}',
   'cs_test_seed_1', 'pi_seed_1', unixepoch() - 7200, NULL, NULL, unixepoch() - 7300),
  (2, 2, 'customer@novap.local', 'fulfilled', 10990, 995, 1090, 11985,
   '{"name":"Dev Customer","line1":"20 Sample Road","line2":"Unit 4","city":"Melbourne","state":"VIC","postcode":"3000","country":"AU","phone":"+61400000002"}',
   'cs_test_seed_2', 'pi_seed_2', unixepoch() - 259200, unixepoch() - 172800, 'AP123456789AU', unixepoch() - 259300),
  (3, NULL, 'sam@example.com', 'pending', 3995, 995, 454, 4990, NULL, 'cs_test_seed_3', NULL, NULL, NULL, NULL, unixepoch() - 600),
  (4, NULL, 'jo@example.com', 'cancelled', 8995, 995, 908, 9990, NULL, 'cs_test_seed_4', NULL, NULL, NULL, NULL, unixepoch() - 86400),
  (5, 2, 'customer@novap.local', 'refunded', 17990, 0, 1635, 17990,
   '{"name":"Dev Customer","line1":"20 Sample Road","line2":"Unit 4","city":"Melbourne","state":"VIC","postcode":"3000","country":"AU","phone":"+61400000002"}',
   'cs_test_seed_5', 'pi_seed_5', unixepoch() - 604800, NULL, NULL, unixepoch() - 604900);

INSERT INTO order_items (order_id, variant_id, product_name, variant_label, sku, unit_price_cents, quantity) VALUES
  (1, 1, 'Reference 01', 'Small', 'REF01-S', 4995, 1),
  (1, 7, 'Storage Case', 'Standard', 'CASE-BLK', 2495, 1),
  (2, 3, 'Reference 02', 'Small', 'REF02-S', 5495, 2),
  (3, 5, 'Reference 03', 'Small', 'REF03-S', 3995, 1),
  (4, 2, 'Reference 01', 'Large', 'REF01-L', 8995, 1),
  (5, 2, 'Reference 01', 'Large', 'REF01-L', 8995, 2);
