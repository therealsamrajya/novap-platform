// Production Worker for the admin (wrangler.jsonc). Static files are served by Cloudflare
// directly; only /api/* runs this code (assets.run_worker_first), which forwards the request
// to the API Worker through a service binding. Same origin for the browser, so the session
// cookie, CSRF check and image headers work without a shared domain.

type Env = { API: { fetch: (request: Request) => Promise<Response> } };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return env.API.fetch(request);
  },
};
