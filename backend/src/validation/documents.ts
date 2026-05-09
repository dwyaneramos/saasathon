import { z } from "zod";

const documentNameSchema = z
	.string()
	.trim()
	.min(1, "File name is required")
	.max(180, "File name must be 180 characters or fewer")
	.refine((value) => value !== "." && value !== "..", {
		message: "File name is invalid",
	})
	.refine((value) => !/[\\/]/.test(value), {
		message: "File name cannot contain slashes",
	})
	.refine((value) => !/[\u0000-\u001F]/.test(value), {
		message: "File name contains invalid characters",
	});

export const createCategorySchema = z.object({
	name: z.string().trim().min(2).max(80),
	spaceId: z.number().int().positive().nullable().optional(),
	description: z.string().trim().max(500).optional(),
	keywords: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	documentId: z.number().int().positive().optional(),
});

export const updateCategorySchema = z.object({
	name: z.string().trim().min(2).max(80),
});

export const updateDocumentSchema = z.object({
	name: documentNameSchema,
});
