import { z } from "zod";
import { required } from "./validation";

// Emails are trimmed + lowercased so "Alex@Example.com " and "alex@example.com" are one account.
const email = z
  .string(required("Email is required"))
  .trim()
  .pipe(z.email("Enter a valid email address").max(254).toLowerCase())
  .meta({ format: "email", maxLength: 254, example: "alex@example.com" });

// Max 128: hashing is deliberately slow, so very long passwords would be a cheap way to burn CPU.
export const registerSchema = z.object({
  email,
  name: z.string(required("Name is required")).trim().min(1, "Name is required").max(100).meta({ example: "Alex Citizen" }),
  password: z
    .string(required("Password is required"))
    .min(10, "Password must be at least 10 characters")
    .max(128)
    .meta({ example: "correct-horse-battery" }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

// No length rule on login: a wrong password should get "Invalid email or password", not a hint.
export const loginSchema = z.object({
  email,
  password: z.string(required("Password is required")).min(1, "Password is required").max(128).meta({ example: "correct-horse-battery" }),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const userRoleSchema = z.enum(["customer", "admin"]);
export type UserRole = z.infer<typeof userRoleSchema>;

// The logged-in user as the API returns it. Never includes the password hash.
export const userSchema = z.object({
  id: z.number().int().meta({ example: 1 }),
  email: z.string().meta({ example: "alex@example.com" }),
  name: z.string().meta({ example: "Alex Citizen" }),
  role: userRoleSchema,
  createdAt: z.iso.datetime().meta({ example: "2026-11-02T09:30:00.000Z" }),
});
export type User = z.infer<typeof userSchema>;
