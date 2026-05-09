import { Router } from "express";
import {
	createSpace,
	listSpaces,
	toPublicSpace,
} from "../services/spaceService.js";
import uploadRoutes from "./upload.js";

const router = Router();

router.get("/", async (req, res) => {
	const spaces = await listSpaces();
	res.json({ spaces: spaces.map(toPublicSpace) });
});

router.post("/", async (req, res) => {
	const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
	const createdBy =
		typeof req.body?.createdBy === "number" ? req.body.createdBy : null;

	if (!name) {
		res.status(400).json({ error: "Space name is required" });
		return;
	}

	const space = await createSpace({ name, createdBy });
	res.status(201).json({ space: toPublicSpace(space) });
});

router.use("/:spaceId/upload", uploadRoutes);

export default router;
