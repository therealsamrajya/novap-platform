# API reference

Base URL (local): `http://localhost:8787`

All responses are JSON. Money values are integer cents in AUD, GST-inclusive. Timestamps are ISO 8601 strings.

## Conventions

**Errors**: every non-2xx response has the same shape. The message is always in `error`;
`issues` appears only on validation errors (400). Frontends read `body.error` and nothing else.

```json
{ "error": "Product not found" }
{ "error": "Invalid input", "issues": [ { "path": ["email"], "message": "Invalid email address" } ] }
```

| Status | Meaning |
|---|---|
| 400 | Input failed validation (`issues` lists the problems) |
| 401 | Not logged in (phase 4+) |
| 403 | Logged in but not allowed (phase 4+) |
| 404 | Resource or route not found |
| 409 | Conflict, e.g. duplicate email |
| 500 | Server error. Details are logged, never returned |

**Pagination**: list endpoints accept `page` (default 1) and `limit`, and return:

```json
{ "items": [], "page": 1, "limit": 12, "total": 0 }
```

**Auth**: from phase 4, a session cookie. Send requests with `credentials: "include"`.

---

## Health

### `GET /api/health`

Checks that the Worker can reach D1 and R2.

```json
{ "status": "ok", "env": "development", "db": true, "storage": true, "time": "2026-11-02T00:00:00.000Z" }
```

---

## Catalog (phase 3)

All catalog endpoints are public. Only **visible** products appear: `active` products with at least one
`active` variant. Inactive variants are never returned. Types are in `@novap/shared` (`catalog.ts`).

### `GET /api/categories`

All categories, ordered by `sortOrder`, then name. `productCount` counts visible products only.

```json
[
  { "id": 1, "slug": "collection", "name": "Collection", "productCount": 4 },
  { "id": 2, "slug": "accessories", "name": "Accessories", "productCount": 1 }
]
```

### `GET /api/categories/:slug`

A single category, in the same shape. Errors: `404 Category not found`.

### `GET /api/products`

A paginated list of product cards (`Paginated<ProductSummary>`).

| Param | Type | Default | Notes |
|---|---|---|---|
| `q` | string ≤100 | – | Case-insensitive "contains" match on name, subtitle and description. `%` and `_` are matched literally |
| `category` | slug | – | An unknown slug returns an empty list, not a 404 |
| `minPrice`, `maxPrice` | int cents | – | Compared with `priceFromCents`. `minPrice` must be ≤ `maxPrice` |
| `inStock` | `true` / `false` | – | Whether any variant has stock |
| `featured` | `true` / `false` | – | |
| `sort` | `newest` / `price_asc` / `price_desc` / `name` | `newest` | |
| `page` | int ≥1 | 1 | |
| `limit` | int 1–48 | 12 | |

Empty params (`?q=&category=`) count as not set.

```json
{
  "items": [
    {
      "id": 2,
      "slug": "reference-02",
      "name": "Reference 02",
      "subtitle": "Obsidian / Silver",
      "featured": true,
      "category": { "id": 1, "slug": "collection", "name": "Collection" },
      "priceFromCents": 5495,
      "onSale": true,
      "inStock": true,
      "image": { "url": "/api/images/products/2/main.webp", "alt": "Reference 02" }
    }
  ],
  "page": 1,
  "limit": 12,
  "total": 5
}
```

- `priceFromCents` is the cheapest active variant.
- `onSale` is true if any variant has `compareAtCents` above its price.
- `image` is the first image by sort order, or `null`.

Errors: `400` on invalid params (e.g. `limit=500`, `sort=bogus`, `minPrice > maxPrice`).

### `GET /api/products/:slug`

The product page (`ProductDetail`). It includes active variants (ordered) and all images (ordered).

```json
{
  "id": 2,
  "slug": "reference-02",
  "name": "Reference 02",
  "subtitle": "Obsidian / Silver",
  "description": "…",
  "featured": true,
  "category": { "id": 1, "slug": "collection", "name": "Collection" },
  "variants": [
    { "id": 3, "sku": "REF02-S", "label": "Small", "priceCents": 5495, "compareAtCents": 6495, "inStock": true, "attributes": { "size": "small" } },
    { "id": 4, "sku": "REF02-L", "label": "Large", "priceCents": 9495, "compareAtCents": null, "inStock": false, "attributes": { "size": "large" } }
  ],
  "images": [{ "url": "/api/images/products/2/main.webp", "alt": "Reference 02" }]
}
```

Exact stock counts are not exposed, only `inStock`. Errors: `404 Product not found`, which also covers inactive products and products with no active variant.

### `GET /api/images/<key>`

Streams a product image from R2, using the `url` values above. Prefix them with the API base URL.
Response headers: `Content-Type` from the upload, `ETag`, and `Cache-Control: public, max-age=31536000, immutable`.
The long cache works because image keys are never reused, so a replaced image must get a new key.
Errors: `404 Image not found`, `400 Invalid image path`.

## Contact (phase 3)

_Not built yet._
