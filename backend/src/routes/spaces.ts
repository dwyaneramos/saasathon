import { Router } from "express";
import {
	createSpace,
	getSpace,
	listSpaces,
	listSpacesForUser,
	toPublicSpace,
} from "../services/spaceService.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import {
	listCategories,
	listItemsForCategory,
	toPublicCategory,
	toPublicItem,
} from "../services/documentAnalyzer.js";
import { HttpError } from "../utils/httpError.js";
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

router.get("/:spaceId/categories", async (req, res) => {
	const spaceId = parsePositiveInteger(req.params.spaceId, "spaceId");
	const space = await getSpace(spaceId);

	if (!space) {
		throw new HttpError(404, "Space not found");
	}

	const categories = await listCategories(spaceId);
	res.json({ categories: categories.map(toPublicCategory) });
});

router.get("/:spaceId/categories/:categoryId/items", async (req, res) => {
	const spaceId = parsePositiveInteger(req.params.spaceId, "spaceId");
	const categoryId = parsePositiveInteger(req.params.categoryId, "categoryId");

	const space = await getSpace(spaceId);
	if (!space) {
		throw new HttpError(404, "Space not found");
	}

	const categories = await listCategories(spaceId);
	const category = categories.find((entry) => entry.id === categoryId);

	if (!category) {
		throw new HttpError(404, "Category not found");
	}

	const items = await listItemsForCategory({ spaceId, categoryId });
	res.json({
		items: items.map(toPublicItem),
	});
});

router.use("/:spaceId/upload", uploadRoutes);

export default router;

function parsePositiveInteger(value: string | undefined, fieldName: string) {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 1) {
		throw new HttpError(400, `${fieldName} must be a positive integer`);
	}

	return parsed;
}
