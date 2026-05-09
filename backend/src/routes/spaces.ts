import { Router } from "express";
import {
	createSpace,
	listSpaces,
	listSpacesForUser,
	toPublicSpace,
} from "../services/spaceService.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import uploadRoutes from "./upload.js";

const router = Router();

router.get("/", async (req: AuthRequest, res, next) => {
	const token = req.headers.authorization?.split(" ")[1];
	if (token) {
		requireAuth(req, res, async () => {
			const spaces = await listSpacesForUser(req.userId!);
			res.json({ spaces: spaces.map(toPublicSpace) });
		});
		return;
	}

	const spaces = await listSpaces();
	res.json({ spaces: spaces.map(toPublicSpace) });
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
	const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

	if (!name) {
		res.status(400).json({ error: "Space name is required" });
		return;
	}

	const space = await createSpace({ name, createdBy: req.userId });
	res.status(201).json({ space: toPublicSpace(space) });
});

router.use("/:spaceId/upload", uploadRoutes);

export default router;
