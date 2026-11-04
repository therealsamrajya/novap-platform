import type { ApiError } from "@novap/shared";

// Base URL of the API. Image urls from the API are paths ("/api/images/..."), so they need it too.
// Production builds set it to "" (.env.production): the app's own Worker forwards /api/* to the API.
export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8787").replace(/\/$/, "");

export const assetUrl = (path: string) => `${API_URL}${path}`;

// Every non-2xx response is { error, issues? } (see CLAUDE.md "Error responses"),
// so one error class covers them all. `issues` is set on validation errors (400).
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: NonNullable<ApiError["issues"]> = [],
  ) {
    super(message);
  }
}

type Body = Record<string, unknown> | FormData;
type Query = Record<string, string | number | boolean | undefined | null>;

// Drops empty values, so `{ q: "" }` doesn't send `?q=`.
export function toQuery(params: Query): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

async function request<T>(method: string, path: string, body?: Body): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      // Sends the httpOnly session cookie. The app never sees or stores a token.
      credentials: "include",
      // FormData sets its own multipart Content-Type (with the boundary), so only JSON gets a header.
      headers: body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiRequestError(0, "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data as ApiError | null;
    throw new ApiRequestError(res.status, err?.error ?? "Something went wrong", err?.issues);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query: Query = {}) => request<T>("GET", path + toQuery(query)),
  post: <T>(path: string, body?: Body) => request<T>("POST", path, body),
  patch: <T>(path: string, body: Body) => request<T>("PATCH", path, body),
  delete: (path: string) => request<void>("DELETE", path),
};
