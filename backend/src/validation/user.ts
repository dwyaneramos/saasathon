import { z } from "zod";

const emailSchema = z
	.string()
	.trim()
	.toLowerCase()
	.regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
		message: "Invalid email format",
	});

export const registerSchema = z.object({
	email: emailSchema,
	firstName: z.string().min(3).max(32),
	lastName: z.string().min(3).max(32),
	password: z
		.string()
		.min(8, { message: "Password must be at least 8 characters long" })
		.regex(/[a-z]/, { message: "Password must contain a lowercase letter" })
		.regex(/[A-Z]/, {
			message: "Password must contain an uppercase letter",
		})
		.regex(/[0-9]/, { message: "Password must contain a number" })
		.regex(/[^a-zA-Z0-9]/, {
			message: "Password must contain a special character",
		}),
});

export const loginSchema = z.object({
	email: emailSchema,
	password: z.string().min(1, { message: "Password is required" }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
