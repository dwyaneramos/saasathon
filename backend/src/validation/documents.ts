import { z } from "zod";

export const createCategorySchema = z.object({
	name: z.string().trim().min(2).max(80),
	description: z.string().trim().max(500).optional(),
	keywords: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
	documentId: z.number().int().positive().optional(),
});
