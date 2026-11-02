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

<!-- Document each endpoint here as it is built: method, path, auth, params, example response, errors. -->

_Not built yet._

## Contact (phase 3)

_Not built yet._
