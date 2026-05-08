import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
	userId?: number;
}

export function requireAuth(
	req: AuthRequest,
	res: Response,
	next: NextFunction,
) {
	const token = req.headers.authorization?.split(" ")[1];

	if (!token) {
		res.status(401).json({ error: "No token provided" });
		return;
	}

	try {
		const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
			userId: number;
		};
		req.userId = payload.userId;
		next();
	} catch {
		res.status(401).json({ error: "Invalid or expired token" });
	}
}
