import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

export function validate(schema: ZodSchema) {
	return (req: Request, res: Response, next: NextFunction) => {
		const result = schema.safeParse(req.body);
		if (!result.success) {
			const { formErrors, fieldErrors } = result.error.flatten();
			const message =
				formErrors[0] ??
				Object.values(fieldErrors).flat()[0] ??
				"Validation failed";

			res.status(400).json({ error: message });
			return;
		}
		req.body = result.data;
		next();
	};
}
