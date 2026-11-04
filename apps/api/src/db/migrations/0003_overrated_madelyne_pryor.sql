ALTER TABLE `product_images` ADD `variant_id` integer REFERENCES variants(id) ON DELETE set null;--> statement-breakpoint
CREATE INDEX `product_images_variant_idx` ON `product_images` (`variant_id`);