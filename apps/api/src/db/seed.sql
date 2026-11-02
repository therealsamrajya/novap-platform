-- Local development sample data. Placeholder products only — real products
-- will be entered through the admin panel. Prices in AUD cents, GST-inclusive.
-- Run: pnpm db:seed:local   (or pnpm db:reset:local to wipe + migrate + seed)
-- Admin user is created in phase 4 (needs the password hashing helper).

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
