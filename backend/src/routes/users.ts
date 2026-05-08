import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getDb } from "../db/index.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { registerSchema, loginSchema } from "../validation/user.js";
import type { User, PublicUser } from "../types/user.js";

const router = Router();

function toPublicUser(user: User): PublicUser {
	const { password_hash, ...pub } = user;
	return pub;
}

function signToken(userId: number) {
	return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: "7d" });
}

router.post("/register", validate(registerSchema), async (req, res) => {
	const { email, first_name, last_name, password } = req.body;
	const password_hash = await bcrypt.hash(password, 12);

	try {
		const { rows } = await getDb().query<User>(
			`INSERT INTO users (email, first_name, last_name, password_hash)
       VALUES ($1, $2, $3, $4) RETURNING *`,
			[email, first_name, last_name, password_hash],
		);

		const token = signToken(rows[0].id);
		res.status(201).json({ user: toPublicUser(rows[0]), token });
	} catch (err: any) {
		if (err.code === "23505") {
			// unique violation
			res.status(409).json({ error: "Email already taken" });
			return;
		}
		throw err;
	}
});

router.post("/login", validate(loginSchema), async (req, res) => {
	const { email, password } = req.body;
	const { rows } = await getDb().query<User>(
		"SELECT * FROM users WHERE email = $1",
		[email],
	);

	const user = rows[0];
	const valid = user && (await bcrypt.compare(password, user.password_hash));

	if (!valid) {
		res.status(401).json({ error: "Invalid email or password" });
		return;
	}

	const token = signToken(user.id);
	res.json({ user: toPublicUser(user), token });
});

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
	const { rows } = await getDb().query<User>(
		"SELECT * FROM users WHERE id = $1",
		[req.userId],
	);

	if (!rows[0]) {
		res.status(404).json({ error: "User not found" });
		return;
	}

	res.json({ user: toPublicUser(rows[0]) });
});

export default router;
