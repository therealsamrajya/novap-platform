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
