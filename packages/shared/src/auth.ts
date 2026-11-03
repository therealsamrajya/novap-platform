import { z } from "zod";
import { required } from "./validation";

// Emails are trimmed + lowercased so "Alex@Example.com " and "alex@example.com" are one account.
const email = z
  .string(required("Email is required"))
  .trim()
  .pipe(z.email("Enter a valid email address").max(254).toLowerCase())
  .meta({ format: "email", maxLength: 254, example: "alex@example.com" });

// Rules for choosing a password (register, reset).
// Max 128: hashing is deliberately slow, so very long passwords would be a cheap way to burn CPU.
const newPassword = z
  .string(required("Password is required"))
  .min(10, "Password must be at least 10 characters")
  .max(128)
  .meta({ example: "correct-horse-battery" });

export const registerSchema = z.object({
  email,
  name: z.string(required("Name is required")).trim().min(1, "Name is required").max(100).meta({ example: "Alex Citizen" }),
  password: newPassword,
});
export type RegisterInput = z.infer<typeof registerSchema>;

// No length rule on login: a wrong password should get "Invalid email or password", not a hint.
export const loginSchema = z.object({
  email,
  password: z.string(required("Password is required")).min(1, "Password is required").max(128).meta({ example: "correct-horse-battery" }),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// "Accepted; an email may follow." Forgot-password answers this whether or not the email
// has an account, so the endpoint can't be used to find out who is registered.
export const emailRequestedSchema = z.object({
  received: z.literal(true),
});
export type EmailRequested = z.infer<typeof emailRequestedSchema>;

export const resetPasswordSchema = z.object({
  token: z
    .string(required("Reset token is required"))
    .min(1, "Reset token is required")
    .max(200)
    .meta({ description: "The `token` query parameter from the emailed link", example: "q8V1u3...base64url" }),
  password: newPassword,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const userRoleSchema = z.enum(["customer", "admin"]);
export type UserRole = z.infer<typeof userRoleSchema>;

// The logged-in user as the API returns it. Never includes the password hash.
export const userSchema = z.object({
  id: z.number().int().meta({ example: 1 }),
  email: z.string().meta({ example: "alex@example.com" }),
  name: z.string().meta({ example: "Alex Citizen" }),
  role: userRoleSchema,
  emailVerified: z.boolean().meta({
    description: "Whether the user confirmed the email. Guest orders with this email show in the account only once true",
    example: true,
  }),
  createdAt: z.iso.datetime().meta({ example: "2026-11-02T09:30:00.000Z" }),
});
export type User = z.infer<typeof userSchema>;

export const verifyEmailSchema = z.object({
  token: z
    .string(required("Verification token is required"))
    .min(1, "Verification token is required")
    .max(200)
    .meta({ description: "The `token` query parameter from the emailed link", example: "Zk3p...base64url" }),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
