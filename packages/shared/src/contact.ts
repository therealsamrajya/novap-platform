import { z } from "zod";
import { required } from "./validation";

// Public contact form. The same schema validates the shop form and the API.
export const contactMessageSchema = z.object({
  name: z.string(required("Name is required")).trim().min(1, "Name is required").max(100).meta({ example: "Alex Citizen" }),
  email: z.email("Enter a valid email address").max(254).toLowerCase().meta({ example: "alex@example.com" }),
  subject: z
    .string(required("Subject is required"))
    .trim()
    .min(1, "Subject is required")
    .max(150)
    .meta({ example: "Question about Reference 02" }),
  message: z
    .string(required("Message is required"))
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(5000)
    .meta({ example: "Hi, is the Large size coming back in stock soon?" }),
  // Honeypot: hidden in the form and left empty by people. Bots that fill every
  // field get a normal-looking 201, but nothing is saved.
  website: z.string().max(200).optional().meta({ description: "Honeypot. Must be left empty; hide it in the form" }),
});
export type ContactMessageInput = z.infer<typeof contactMessageSchema>;

export const contactReceivedSchema = z.object({
  received: z.literal(true),
});
export type ContactReceived = z.infer<typeof contactReceivedSchema>;
