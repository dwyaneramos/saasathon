import { z } from "zod";

export const registerSchema = z.object({
	email: z
		.string()
		.regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
			message: "Invalid email format",
		}),
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
	email: z
		.string()
		.regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
			message: "Invalid email format",
		}),
	password: z
		.string()
		.min(8, { message: "Password must be at least 8 characters long" }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
