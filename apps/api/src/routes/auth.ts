import { createRoute } from "@hono/zod-openapi";
import { loginSchema, registerSchema, userSchema, type User } from "@novap/shared";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { getDb } from "../db/client";
import type { AppEnv } from "../index";
import { cookieAuth, createRouter, errors, json } from "../lib/openapi";
import { clearSessionCookie, currentUser, getSessionToken, setSessionCookie } from "../middleware/auth";
import { createSession, createUser, deleteSession, verifyCredentials } from "../services/auth";

const Register = registerSchema.openapi("RegisterInput");
const Login = loginSchema.openapi("LoginInput");
const UserSchema = userSchema.openapi("User");

const cookieNote = "Sets the `novap_session` cookie (httpOnly). Browsers must send requests with `credentials: \"include\"`.";

// POST /api/auth/register — create a customer account and log in
const register = createRoute({
  method: "post",
  path: "/register",
  tags: ["Auth"],
  summary: "Register",
  description: `Creates a customer account and logs it in. ${cookieNote}`,
  request: { body: { content: { "application/json": { schema: Register } }, required: true } },
  responses: {
    201: json(UserSchema, "Account created and logged in"),
    400: errors[400],
    409: errors[409],
    415: errors[415],
    500: errors[500],
  },
});

// POST /api/auth/login — start a session
const login = createRoute({
  method: "post",
  path: "/login",
  tags: ["Auth"],
  summary: "Log in",
  description: `${cookieNote} Sessions last 30 days (12 hours for admins) and renew while in use.`,
  request: { body: { content: { "application/json": { schema: Login } }, required: true } },
  responses: {
    200: json(UserSchema, "Logged in"),
    400: errors[400],
    401: errors[401],
    415: errors[415],
    500: errors[500],
  },
});

// POST /api/auth/logout — end the current session
const logout = createRoute({
  method: "post",
  path: "/logout",
  tags: ["Auth"],
  summary: "Log out",
  description:
    "Deletes the session and clears the cookie. Succeeds even if not logged in. " +
    "Has no body, so it must come from the shop or admin origin (browsers send `Origin` automatically); otherwise 403.",
  responses: { 204: { description: "Logged out" }, 500: errors[500] },
});

// GET /api/auth/me — who is logged in
const me = createRoute({
  method: "get",
  path: "/me",
  tags: ["Auth"],
  summary: "Current user",
  security: cookieAuth,
  responses: { 200: json(UserSchema, "The logged-in user"), 401: errors[401], 500: errors[500] },
});

// Logging in while already logged in replaces the old session instead of leaving it behind.
async function startSession(c: Context<AppEnv>, user: User) {
  const db = getDb(c.env.DB);
  const old = getSessionToken(c);
  if (old) await deleteSession(db, old);
  const { token, expiresAt } = await createSession(db, user);
  setSessionCookie(c, token, expiresAt);
}

export const authRoute = createRouter()
  .openapi(register, async (c) => {
    const user = await createUser(getDb(c.env.DB), c.req.valid("json"));
    if (!user) throw new HTTPException(409, { message: "An account with this email already exists" });
    await startSession(c, user);
    return c.json(user, 201);
  })
  .openapi(login, async (c) => {
    const user = await verifyCredentials(getDb(c.env.DB), c.req.valid("json"));
    if (!user) throw new HTTPException(401, { message: "Invalid email or password" });
    await startSession(c, user);
    return c.json(user, 200);
  })
  .openapi(logout, async (c) => {
    const token = getSessionToken(c);
    if (token) await deleteSession(getDb(c.env.DB), token);
    clearSessionCookie(c);
    return c.body(null, 204);
  })
  .openapi(me, (c) => c.json(currentUser(c), 200));
