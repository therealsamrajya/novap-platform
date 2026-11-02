import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Conventions
// - ids: auto-increment integers (sessions use a random text id instead)
// - money: integer cents, AUD, GST-inclusive
// - timestamps: unix seconds, read back as JS Date (mode: "timestamp")
// - JSON columns: stored as text, parsed automatically (mode: "json")
// ---------------------------------------------------------------------------

const createdAt = () =>
  integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`);
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date());

// ---------------------------------------------------------------- users / auth

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["customer", "admin"] }).notNull().default("customer"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Login sessions. The cookie holds a random token; only its SHA-256 hash is
// stored here, so a leaked database can't be used to hijack sessions.
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256(token)
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const addresses = sqliteTable(
  "addresses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    postcode: text("postcode").notNull(),
    country: text("country").notNull().default("AU"),
    phone: text("phone"),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("addresses_user_idx").on(t.userId)],
);

// ---------------------------------------------------------------- catalogue

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

// A product is the thing shown on the listing page. What you actually buy is
// a variant (size / strength / colour...), which has its own price and stock.
export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    subtitle: text("subtitle"),
    description: text("description").notNull().default(""),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("products_category_idx").on(t.categoryId)],
);

export const variants = sqliteTable(
  "variants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().unique(),
    label: text("label").notNull(), // e.g. "10 mg", "Large"
    priceCents: integer("price_cents").notNull(),
    compareAtCents: integer("compare_at_cents"), // original price, for showing a sale
    stock: integer("stock").notNull().default(0),
    attributes: text("attributes", { mode: "json" }).$type<Record<string, string>>(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("variants_product_idx").on(t.productId)],
);

// Image files live in R2; this table stores the R2 key and display order.
export const productImages = sqliteTable(
  "product_images",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    alt: text("alt").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

// ---------------------------------------------------------------- orders

export type ShippingAddress = {
  name: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postcode: string;
  country: string;
  phone?: string | null;
};

// Every order has an email. userId is set for logged-in customers and null
// for guests — that is the only difference between a guest and a user order.
export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    status: text("status", {
      enum: ["pending", "paid", "fulfilled", "cancelled", "refunded"],
    })
      .notNull()
      .default("pending"),
    currency: text("currency").notNull().default("aud"),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull().default(0),
    gstCents: integer("gst_cents").notNull().default(0), // GST included in total, for receipts
    totalCents: integer("total_cents").notNull(),
    shippingAddress: text("shipping_address", { mode: "json" }).$type<ShippingAddress>(),
    stripeSessionId: text("stripe_session_id").unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    paidAt: integer("paid_at", { mode: "timestamp" }),
    fulfilledAt: integer("fulfilled_at", { mode: "timestamp" }),
    trackingNumber: text("tracking_number"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("orders_user_idx").on(t.userId),
    index("orders_email_idx").on(t.email),
    index("orders_status_idx").on(t.status),
  ],
);

// Name/price are copied at purchase time ("snapshot") so order history stays
// correct even if the product is later renamed, repriced or deleted.
export const orderItems = sqliteTable(
  "order_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: integer("variant_id").references(() => variants.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    variantLabel: text("variant_label").notNull(),
    sku: text("sku").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

// Stripe can deliver the same webhook more than once. Recording processed
// event ids lets the webhook skip duplicates (idempotency).
export const stripeEvents = sqliteTable("stripe_events", {
  id: text("id").primaryKey(), // Stripe event id, e.g. evt_...
  type: text("type").notNull(),
  processedAt: createdAt(),
});

// ---------------------------------------------------------------- contact

export const contactMessages = sqliteTable(
  "contact_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: text("status", { enum: ["new", "read", "archived"] }).notNull().default("new"),
    createdAt: createdAt(),
  },
  (t) => [index("contact_messages_status_idx").on(t.status)],
);

// ---------------------------------------------------------------- relations
// These don't change the database; they tell Drizzle how tables connect so
// queries can load nested data, e.g. db.query.orders.findMany({ with: { items: true } }).

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  addresses: many(addresses),
  orders: many(orders),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, { fields: [addresses.userId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  variants: many(variants),
  images: many(productImages),
}));

export const variantsRelations = relations(variants, ({ one }) => ({
  product: one(products, { fields: [variants.productId], references: [products.id] }),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  variant: one(variants, { fields: [orderItems.variantId], references: [variants.id] }),
}));
