import { z } from "zod";

export const registerSchema = z.object({
	email: z.string().email(),
	firstName: z.string().min(3).max(32),
	lastName: z.string().min(3).max(32),
	password: z.string().min(8),
});

export const loginSchema = z.object({
	email: z.string().email(),
	password: z.string(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
