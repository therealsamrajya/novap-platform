import type { User } from "@novap/shared";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { getDb } from "../db/client";
import type { AppEnv } from "../index";
import { SESSION_COOKIE } from "../lib/session";
import { getSessionUser } from "../services/auth";

// httpOnly: page scripts can't read it, so XSS can't steal it.
// SameSite=Lax: not sent on cross-site POSTs (CSRF). Shop, admin and API share one
// site (localhost in dev, subdomains of one domain in prod), so Lax still lets it through.
// Secure is off in development only, because `wrangler dev` serves plain http.
export function setSessionCookie(c: Context<AppEnv>, token: string, expiresAt: Date) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: c.env.APP_ENV !== "development",
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(c: Context<AppEnv>) {
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: c.env.APP_ENV !== "development" });
}

export const getSessionToken = (c: Context<AppEnv>) => getCookie(c, SESSION_COOKIE);

// Runs on every /api request. Sets c.var.user to the logged-in user, or null.
// Never rejects: routes decide whether a user is required (requireAuth / requireAdmin).
export const loadSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("user", null);
  const token = getSessionToken(c);
  if (token) {
    const session = await getSessionUser(getDb(c.env.DB), token);
    if (session) {
      c.set("user", session.user);
      if (session.renewedUntil) setSessionCookie(c, token, session.renewedUntil);
    } else {
      clearSessionCookie(c); // expired or revoked: stop the browser sending it
    }
  }
  await next();
};

// Returns the logged-in user or throws 401. Use in handlers that need the user object.
export function currentUser(c: Context<AppEnv>): User {
  const user = c.get("user");
  if (!user) throw new HTTPException(401, { message: "Not logged in" });
  return user;
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  currentUser(c);
  await next();
};

// 401 if not logged in, 403 if logged in but not an admin.
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (currentUser(c).role !== "admin") throw new HTTPException(403, { message: "Admin access required" });
  await next();
};
