import { createRoute } from "@hono/zod-openapi";
import {
  forgotPasswordSchema,
  loginSchema,
  emailRequestedSchema,
  registerSchema,
  resetPasswordSchema,
  userSchema,
  verifyEmailSchema,
  type User,
} from "@novap/shared";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { getDb } from "../db/client";
import type { AppEnv } from "../index";
import { getMailer } from "../lib/email";
import { cookieAuth, createRouter, errors, json } from "../lib/openapi";
import { clearSessionCookie, currentUser, getSessionToken, setSessionCookie } from "../middleware/auth";
import { createSession, createUser, deleteSession, verifyCredentials } from "../services/auth";
import { verifyEmail } from "../services/email-verification";
import { sendEmailVerification, sendPasswordReset } from "../services/notifications";
import { createPasswordResetToken, resetPassword, RESET_TOKEN_TTL_MS } from "../services/password-reset";

const Register = registerSchema.openapi("RegisterInput");
const Login = loginSchema.openapi("LoginInput");
const UserSchema = userSchema.openapi("User");
const ForgotPassword = forgotPasswordSchema.openapi("ForgotPasswordInput");
const EmailRequested = emailRequestedSchema.openapi("EmailRequested");
const VerifyEmail = verifyEmailSchema.openapi("VerifyEmailInput");
const ResetPassword = resetPasswordSchema.openapi("ResetPasswordInput");

const cookieNote = "Sets the `novap_session` cookie (httpOnly). Browsers must send requests with `credentials: \"include\"`.";

// POST /api/auth/register — create a customer account and log in
const register = createRoute({
  method: "post",
  path: "/register",
  tags: ["Auth"],
  summary: "Register",
  description: `Creates a customer account, logs it in and emails a link to confirm the address (see verify-email). ${cookieNote}`,
  request: { body: { content: { "application/json": { schema: Register } }, required: true } },
  responses: {
    201: json(UserSchema, "Account created and logged in"),
    400: errors[400],
    409: errors[409],
    415: errors[415],
    429: errors[429],
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
    429: errors[429],
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

// POST /api/auth/password/forgot — email a password reset link
const forgotPassword = createRoute({
  method: "post",
  path: "/password/forgot",
  tags: ["Auth"],
  summary: "Request a password reset",
  description:
    "If an account has this email, sends it a link to `SHOP_URL/reset-password?token=...`, valid for 1 hour and usable once. " +
    "Requesting again invalidates the previous link. Always answers 202 with the same body, whether or not the account exists.",
  request: { body: { content: { "application/json": { schema: ForgotPassword } }, required: true } },
  responses: {
    202: json(EmailRequested, "Accepted. An email is sent if the account exists"),
    400: errors[400],
    415: errors[415],
    429: errors[429],
    500: errors[500],
  },
});

// POST /api/auth/password/reset — set a new password with the emailed token
const resetPasswordRoute = createRoute({
  method: "post",
  path: "/password/reset",
  tags: ["Auth"],
  summary: "Reset the password",
  description:
    "Sets a new password using the token from the reset email. Logs the account out everywhere (all sessions deleted, " +
    "cookie cleared); the user then logs in with the new password. 400 if the token is unknown, used or expired.",
  request: { body: { content: { "application/json": { schema: ResetPassword } }, required: true } },
  responses: {
    204: { description: "Password changed. Log in again" },
    400: errors[400],
    415: errors[415],
    429: errors[429],
    500: errors[500],
  },
});

// POST /api/auth/verify-email — confirm the email with the token from the link
const verifyEmailRoute = createRoute({
  method: "post",
  path: "/verify-email",
  tags: ["Auth"],
  summary: "Confirm email",
  description:
    "Confirms the address using the token from the email sent at registration (link: `SHOP_URL/verify-email?token=...`, " +
    "valid 24 hours, usable once). Needs no login, so the link works on any device. Guest orders placed with this " +
    "email then show in the account. 400 if the token is unknown, used or expired.",
  request: { body: { content: { "application/json": { schema: VerifyEmail } }, required: true } },
  responses: {
    204: { description: "Email confirmed" },
    400: errors[400],
    415: errors[415],
    500: errors[500],
  },
});

// POST /api/auth/verify-email/resend — send the confirmation link again
const resendVerification = createRoute({
  method: "post",
  path: "/verify-email/resend",
  tags: ["Auth"],
  summary: "Resend the confirmation email",
  description:
    "Emails a new confirmation link to the logged-in user; earlier links stop working. 409 if already confirmed. " +
    "Has no body, so it must come from the shop or admin origin (browsers send `Origin` automatically); otherwise 403.",
  security: cookieAuth,
  responses: {
    202: json(EmailRequested, "Accepted. The email is on its way"),
    401: errors[401],
    409: errors[409],
    429: errors[429],
    500: errors[500],
  },
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
    c.executionCtx.waitUntil(sendEmailVerification(getDb(c.env.DB), getMailer(c.env), c.env.SHOP_URL, user));
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
  .openapi(me, (c) => c.json(currentUser(c), 200))
  .openapi(forgotPassword, async (c) => {
    const reset = await createPasswordResetToken(getDb(c.env.DB), c.req.valid("json").email);
    // Sent after the response, so a known email doesn't answer noticeably slower than an unknown one.
    if (reset) {
      c.executionCtx.waitUntil(sendPasswordReset(getMailer(c.env), c.env.SHOP_URL, reset, RESET_TOKEN_TTL_MS / 60_000));
    }
    return c.json({ received: true as const }, 202);
  })
  .openapi(resetPasswordRoute, async (c) => {
    const { token, password } = c.req.valid("json");
    const ok = await resetPassword(getDb(c.env.DB), token, password);
    if (!ok) throw new HTTPException(400, { message: "This reset link is invalid or has expired. Request a new one" });
    // The session this browser had (if any) was deleted with the others.
    clearSessionCookie(c);
    return c.body(null, 204);
  })
  .openapi(verifyEmailRoute, async (c) => {
    const ok = await verifyEmail(getDb(c.env.DB), c.req.valid("json").token);
    if (!ok) throw new HTTPException(400, { message: "This confirmation link is invalid or has expired. Request a new one" });
    return c.body(null, 204);
  })
  .openapi(resendVerification, async (c) => {
    const user = currentUser(c);
    if (user.emailVerified) throw new HTTPException(409, { message: "Your email is already confirmed" });
    c.executionCtx.waitUntil(sendEmailVerification(getDb(c.env.DB), getMailer(c.env), c.env.SHOP_URL, user));
    return c.json({ received: true as const }, 202);
  });
