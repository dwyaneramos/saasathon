import { z } from "zod";

export const registerSchema = z.object({
	email: z.string().email(),
	username: z.string().min(3).max(32),
	password: z.string().min(8),
});

export const loginSchema = z.object({
	email: z.string().email(),
	password: z.string(),
});

export const updateUserSchema = z
	.object({
		email: z.string().email().optional(),
		username: z.string().min(3).max(32).optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field must be provided",
	});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
