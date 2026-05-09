import { Router } from "express";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
	createSpace,
	deleteSpace,
	listSpaces,
	listSpacesForUser,
	toPublicSpace,
	updateSpace,
} from "../services/spaceService.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import uploadRoutes from "./upload.js";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, "../../upload");

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

router.patch("/:spaceId", requireAuth, async (req: AuthRequest, res) => {
	const spaceId = getSpaceIdFromParams(req);
	const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

	if (!spaceId) {
		res.status(400).json({ error: "spaceId must be a positive integer" });
		return;
	}

	if (!name || name.length > 80) {
		res.status(400).json({ error: "Space name must be 1-80 characters" });
		return;
	}

	const space = await updateSpace({
		spaceId,
		userId: req.userId!,
		name,
	});
	if (!space) {
		res.status(404).json({ error: "Space not found" });
		return;
	}

	res.json({ space: toPublicSpace(space) });
});

router.delete("/:spaceId", requireAuth, async (req: AuthRequest, res) => {
	const spaceId = getSpaceIdFromParams(req);

	if (!spaceId) {
		res.status(400).json({ error: "spaceId must be a positive integer" });
		return;
	}

	const space = await deleteSpace({
		spaceId,
		userId: req.userId!,
	});
	if (!space) {
		res.status(404).json({ error: "Space not found" });
		return;
	}

	await fs.rm(path.join(uploadDir, `space-${spaceId}`), {
		recursive: true,
		force: true,
	});

	res.json({ success: true, space: toPublicSpace(space) });
});

router.use("/:spaceId/upload", uploadRoutes);

export default router;

function getSpaceIdFromParams(req: AuthRequest) {
	const spaceId = Number(req.params.spaceId);
	return Number.isInteger(spaceId) && spaceId > 0 ? spaceId : null;
}
