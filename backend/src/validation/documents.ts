import { z } from "zod";

export const createCategorySchema = z.object({
	name: z.string().trim().min(2).max(80),
	spaceId: z.number().int().positive().nullable().optional(),
	description: z.string().trim().max(500).optional(),
	keywords: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	documentId: z.number().int().positive().optional(),
});
