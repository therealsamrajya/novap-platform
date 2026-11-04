// Production Worker for the shop (wrangler.jsonc). Static files are served by Cloudflare
// directly; only /api/* runs this code (assets.run_worker_first), which forwards the request
// to the API Worker through a service binding. The browser only ever sees the shop's origin,
// so the session cookie, CSRF check and image headers work without a shared domain.

type Env = { API: { fetch: (request: Request) => Promise<Response> } };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    // Admin endpoints are only reachable through the admin Worker's address. The API checks the
    // role anyway; this keeps them off the public shop host entirely.
    if (pathname === "/api/admin" || pathname.startsWith("/api/admin/")) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    // Passed through unchanged: method, body (the Stripe webhook needs the exact bytes),
    // cookies, Origin and Cloudflare's cf-connecting-ip (used by the API's rate limits).
    return env.API.fetch(request);
  },
};
