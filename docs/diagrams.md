# Diagrams

Visual reference for the API (`apps/api`). Diagrams use [Mermaid](https://mermaid.js.org), which GitHub renders natively. In VS Code, install a Mermaid preview extension (e.g. "Markdown Preview Mermaid Support").

**Easier to read:** open [diagrams.html](diagrams.html) in a browser — full screen, scroll to zoom, drag to pan, export SVG. It holds copies of the blocks below; keep both in sync.

Source of truth is the code. When `apps/api/src/db/schema.ts` or the layer structure changes, update this file in the same PR.

- [1. Database schema (ER diagram)](#1-database-schema-er-diagram)
- [2. Domain model (class diagram)](#2-domain-model-class-diagram)
- [3. API layers (class diagram)](#3-api-layers-class-diagram)

## 1. Database schema (ER diagram)

Every table in D1, with columns, keys and foreign keys. Money is integer cents (AUD, GST-inclusive); timestamps are unix seconds.

```mermaid
erDiagram
    users ||--o{ sessions : "has"
    users ||--o{ addresses : "has"
    users |o--o{ orders : "places (null = guest)"
    categories |o--o{ products : "groups"
    products ||--|{ variants : "sold as"
    products ||--o{ product_images : "shown with"
    orders ||--|{ order_items : "contains"
    variants |o--o{ order_items : "snapshot of"

    users {
        integer id PK
        text email UK
        text password_hash
        text name
        text role "customer | admin"
        integer created_at
        integer updated_at
    }
    sessions {
        text id PK "sha256(token)"
        integer user_id FK "cascade"
        integer expires_at
        integer created_at
    }
    addresses {
        integer id PK
        integer user_id FK "cascade"
        text name
        text line1
        text line2 "nullable"
        text city
        text state
        text postcode
        text country "default AU"
        text phone "nullable"
        boolean is_default
        integer created_at
    }
    categories {
        integer id PK
        text name
        text slug UK
        integer sort_order
        integer created_at
    }
    products {
        integer id PK
        text slug UK
        text name
        text subtitle "nullable"
        text description
        integer category_id FK "set null"
        boolean active
        boolean featured
        integer created_at
        integer updated_at
    }
    variants {
        integer id PK
        integer product_id FK "cascade"
        text sku UK
        text label "e.g. 10 mg"
        integer price_cents
        integer compare_at_cents "nullable, sale display"
        integer stock
        json attributes "Record<string,string>"
        boolean active
        integer sort_order
        integer created_at
        integer updated_at
    }
    product_images {
        integer id PK
        integer product_id FK "cascade"
        text r2_key "file lives in R2"
        text alt
        integer sort_order
        integer created_at
    }
    orders {
        integer id PK
        integer user_id FK "set null, nullable"
        text email
        text status "pending | paid | fulfilled | cancelled | refunded"
        text currency "default aud"
        integer subtotal_cents
        integer shipping_cents
        integer gst_cents
        integer total_cents
        json shipping_address "ShippingAddress"
        text stripe_session_id UK
        text stripe_payment_intent_id
        integer paid_at "nullable"
        integer fulfilled_at "nullable"
        text tracking_number "nullable"
        integer created_at
        integer updated_at
    }
    order_items {
        integer id PK
        integer order_id FK "cascade"
        integer variant_id FK "set null, nullable"
        text product_name "snapshot"
        text variant_label "snapshot"
        text sku "snapshot"
        integer unit_price_cents "snapshot"
        integer quantity
    }
    stripe_events {
        text id PK "evt_..."
        text type
        integer processed_at
    }
    contact_messages {
        integer id PK
        text name
        text email
        text subject
        text message
        text status "new | read | archived"
        integer created_at
    }
```

`stripe_events` and `contact_messages` stand alone: no foreign keys.

**On delete**

| Parent deleted | Child rows |
|---|---|
| user | sessions, addresses deleted; orders kept with `user_id = null` |
| category | products kept with `category_id = null` |
| product | variants, product_images deleted |
| order | order_items deleted |
| variant | order_items kept with `variant_id = null` (snapshot columns keep history correct) |

## 2. Domain model (class diagram)

Same data seen as objects, the way Drizzle relations expose it (`db.query.products.findFirst({ with: { variants: true, images: true } })`). Field names are camelCase as in TypeScript. Association names match the keys in the `relations()` blocks of `schema.ts`.

```mermaid
classDiagram
    direction LR

    class User {
        +number id
        +string email
        +string passwordHash
        +string name
        +UserRole role
        +Date createdAt
        +Date updatedAt
    }
    class UserRole {
        <<enumeration>>
        customer
        admin
    }
    class Session {
        +string id  sha256 of token
        +number userId
        +Date expiresAt
        +Date createdAt
    }
    class Address {
        +number id
        +number userId
        +string name
        +string line1
        +string? line2
        +string city
        +string state
        +string postcode
        +string country
        +string? phone
        +boolean isDefault
    }
    class Category {
        +number id
        +string name
        +string slug
        +number sortOrder
    }
    class Product {
        +number id
        +string slug
        +string name
        +string? subtitle
        +string description
        +number? categoryId
        +boolean active
        +boolean featured
    }
    class Variant {
        +number id
        +number productId
        +string sku
        +string label
        +number priceCents
        +number? compareAtCents
        +number stock
        +object attributes  JSON map
        +boolean active
        +number sortOrder
    }
    class ProductImage {
        +number id
        +number productId
        +string r2Key
        +string alt
        +number sortOrder
    }
    class Order {
        +number id
        +number? userId
        +string email
        +OrderStatus status
        +number subtotalCents
        +number shippingCents
        +number gstCents
        +number totalCents
        +ShippingAddress shippingAddress
        +string? stripeSessionId
        +Date? paidAt
        +Date? fulfilledAt
        +string? trackingNumber
    }
    class OrderStatus {
        <<enumeration>>
        pending
        paid
        fulfilled
        cancelled
        refunded
    }
    class ShippingAddress {
        <<value object in JSON column>>
        +string name
        +string line1
        +string? line2
        +string city
        +string state
        +string postcode
        +string country
        +string? phone
    }
    class OrderItem {
        +number id
        +number orderId
        +number? variantId
        +string productName
        +string variantLabel
        +string sku
        +number unitPriceCents
        +number quantity
    }
    class StripeEvent {
        +string id
        +string type
        +Date processedAt
    }
    class ContactMessage {
        +number id
        +string name
        +string email
        +string subject
        +string message
        +ContactStatus status
    }
    class ContactStatus {
        <<enumeration>>
        new
        read
        archived
    }

    User "1" --> "*" Session : sessions
    User "1" --> "*" Address : addresses
    User "0..1" --> "*" Order : orders
    User ..> UserRole
    Category "0..1" --> "*" Product : products
    Product "1" *-- "*" Variant : variants
    Product "1" *-- "*" ProductImage : images
    Order "1" *-- "1..*" OrderItem : items
    Order *-- ShippingAddress
    Order ..> OrderStatus
    OrderItem "*" --> "0..1" Variant : variant
    ContactMessage ..> ContactStatus
```

Filled diamond (`*--`) = composition: child rows are deleted with the parent. Plain arrow = association: child survives (foreign key set null) or is owned by the user but not part of it.

## 3. API layers (class diagram)

How the code is split. Routes speak HTTP, services hold logic and take a `Db`, lib holds pure helpers. Arrows mean "calls / depends on". See [architecture.md](architecture.md#layers) for the rules.

```mermaid
classDiagram
    direction TB

    class App {
        <<index.ts — OpenAPIHono app>>
        secureHeaders()
        cors()
        csrf()
        loadSession
        requireAdmin on admin routes
        errorHandler
    }
    class AppEnv {
        <<type>>
        Bindings: Env  DB, BUCKET, SHOP_URL, ADMIN_URL, STRIPE_*, shipping vars
        Variables: user  User or null
    }

    class healthRoute {
        <<route /api/health>>
    }
    class authRoute {
        <<route /api/auth>>
    }
    class categoriesRoute {
        <<route /api/categories>>
    }
    class productsRoute {
        <<route /api/products>>
    }
    class imagesRoute {
        <<route /api/images>>
    }
    class contactRoute {
        <<route /api/contact>>
    }
    class checkoutRoute {
        <<route /api/checkout>>
    }
    class stripeRoute {
        <<route /api/stripe>>
    }
    class adminCategoriesRoute {
        <<route /api/admin/categories>>
    }
    class adminProductsRoute {
        <<route /api/admin/products>>
    }
    class adminVariantsRoute {
        <<route /api/admin/variants>>
    }
    class adminImagesRoute {
        <<route /api/admin/images>>
    }
    class adminContactRoute {
        <<route /api/admin/contact>>
    }

    class authMiddleware {
        <<middleware/auth.ts>>
        loadSession
        requireAuth
        requireAdmin
        currentUser(c) User
        setSessionCookie(c, token, expiresAt)
        clearSessionCookie(c)
        getSessionToken(c)
    }
    class errorMiddleware {
        <<middleware/error.ts>>
        errorHandler(err, c)
    }

    class authService {
        <<services/auth.ts>>
        createUser(db, input) User?
        verifyCredentials(db, input) User?
        createSession(db, user) token, expiresAt
        getSessionUser(db, token) User?
        deleteSession(db, token)
    }
    class catalogService {
        <<services/catalog.ts>>
        listCategories(db) Category[]
        getCategoryBySlug(db, slug) Category?
        listProducts(db, query) Paginated~ProductSummary~
        getProductBySlug(db, slug) ProductDetail?
        firstImageByProduct(db, ids) Map
    }
    class contactService {
        <<services/contact.ts>>
        submitContactMessage(db, input)
    }
    class checkoutService {
        <<services/checkout.ts>>
        createCheckout(db, stripe, config, input, user) CheckoutCreated
        cancelPendingOrder(db, orderId) boolean
        getCheckoutSessionStatus(db, sessionId) CheckoutSessionStatus?
        shippingFor(subtotalCents, config) number
    }
    class stripeWebhookService {
        <<services/stripe-webhook.ts>>
        handleStripeEvent(db, event)
    }
    class adminCatalogService {
        <<services/admin-catalog.ts>>
        categories: list, get, create, update, delete
        products: list, get, create, update, delete
        variants: create, update, delete
    }
    class adminImagesService {
        <<services/admin-images.ts>>
        uploadProductImage(db, bucket, productId, input) AdminProductImage?
        updateProductImage(db, id, input) AdminProductImage?
        deleteProductImage(db, bucket, id) boolean
    }
    class adminContactService {
        <<services/admin-contact.ts>>
        listContactMessages(db, query) Paginated~AdminContactMessage~
        getContactMessage(db, id) AdminContactMessage?
        updateContactMessage(db, id, input) AdminContactMessage?
        deleteContactMessage(db, id) boolean
    }

    class openapiLib {
        <<lib/openapi.ts>>
        createRouter()
        json(schema, description)
        errors
        cookieAuth
        slugParams(example)
        idParams(example)
        adminTags
    }
    class passwordLib {
        <<lib/password.ts>>
        hashPassword(pw) string
        verifyPassword(pw, stored) boolean
    }
    class sessionLib {
        <<lib/session.ts>>
        SESSION_COOKIE
        sessionTtlMs(role)
        newSessionToken()
        hashSessionToken(token)
    }
    class paginationLib {
        <<lib/pagination.ts>>
        pageOffset(page, limit)
        paginated(items, total, page, limit)
    }
    class sqlLib {
        <<lib/sql.ts>>
        containsText(column, term)
        isUniqueViolation(err) boolean
    }
    class imagesLib {
        <<lib/images.ts>>
        imageUrl(r2Key)
        sniffImageType(bytes) type, ext
    }
    class stripeLib {
        <<lib/stripe.ts>>
        getStripe(env) Stripe
    }

    class Db {
        <<db/client.ts — Drizzle over D1>>
        getDb(d1) Db
    }
    class schema {
        <<db/schema.ts>>
        tables + relations
    }
    class shared {
        <<packages/shared — zod schemas + types>>
    }
    class R2 {
        <<Cloudflare R2 bucket>>
    }
    class Stripe {
        <<Stripe API — Checkout Sessions, webhook signatures>>
    }

    App --> AppEnv
    App --> healthRoute
    App --> authRoute
    App --> categoriesRoute
    App --> productsRoute
    App --> imagesRoute
    App --> contactRoute
    App --> checkoutRoute
    App --> stripeRoute
    App --> adminCategoriesRoute
    App --> adminProductsRoute
    App --> adminVariantsRoute
    App --> adminImagesRoute
    App --> adminContactRoute
    App --> authMiddleware
    App --> errorMiddleware

    authRoute --> authService
    authRoute --> authMiddleware
    categoriesRoute --> catalogService
    productsRoute --> catalogService
    contactRoute --> contactService
    checkoutRoute --> checkoutService
    checkoutRoute ..> stripeLib
    stripeRoute --> stripeWebhookService
    stripeRoute ..> stripeLib
    stripeWebhookService --> checkoutService
    checkoutService --> Stripe
    stripeLib ..> Stripe
    imagesRoute --> R2
    adminCategoriesRoute --> adminCatalogService
    adminProductsRoute --> adminCatalogService
    adminProductsRoute --> adminImagesService
    adminVariantsRoute --> adminCatalogService
    adminImagesRoute --> adminImagesService
    adminContactRoute --> adminContactService
    adminCatalogService --> R2
    adminImagesService --> R2

    healthRoute ..> openapiLib
    authRoute ..> openapiLib
    categoriesRoute ..> openapiLib
    productsRoute ..> openapiLib
    imagesRoute ..> openapiLib
    contactRoute ..> openapiLib
    checkoutRoute ..> openapiLib
    stripeRoute ..> openapiLib
    adminCategoriesRoute ..> openapiLib
    adminProductsRoute ..> openapiLib
    adminVariantsRoute ..> openapiLib
    adminImagesRoute ..> openapiLib
    adminContactRoute ..> openapiLib
    openapiLib ..> shared

    authMiddleware --> authService
    authMiddleware ..> sessionLib
    authService ..> passwordLib
    authService ..> sessionLib
    catalogService ..> paginationLib
    catalogService ..> sqlLib
    catalogService ..> imagesLib
    adminCatalogService ..> catalogService
    adminCatalogService ..> paginationLib
    adminCatalogService ..> sqlLib
    adminCatalogService ..> imagesLib
    adminImagesService ..> imagesLib
    adminContactService ..> paginationLib
    adminContactService ..> sqlLib

    authService --> Db
    catalogService --> Db
    contactService --> Db
    checkoutService --> Db
    stripeWebhookService --> Db
    adminCatalogService --> Db
    adminImagesService --> Db
    adminContactService --> Db
    Db --> schema
```

Rule of thumb: arrows only point down (route → service → Db). Services never import from `routes/` or Hono, so other routes can reuse them: the Stripe webhook service calls `cancelPendingOrder` from the checkout service.
