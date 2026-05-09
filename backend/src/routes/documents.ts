import { Router, type Request, type Response } from "express";
import multer from "multer";
import { validate } from "../middleware/validate.js";
import { createCategorySchema } from "../validation/documents.js";
import {
	analyzeImage,
	analyzePdf,
	assignDocumentCategory,
	createCategory,
	listCategories,
	listDocuments,
	toPublicCategory,
	toPublicDocument,
} from "../services/documentAnalyzer.js";

const router = Router();
export const uploadPdfMiddleware = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 10 * 1024 * 1024,
		files: 1,
	},
	fileFilter: (req, file, cb) => {
		if (file.mimetype !== "application/pdf") {
			cb(new Error("Only PDF files are supported"));
			return;
		}
		cb(null, true);
	},
});
export const uploadImageMiddleware = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 10 * 1024 * 1024,
		files: 1,
	},
	fileFilter: (req, file, cb) => {
		if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.mimetype)) {
			cb(new Error("Only PNG, JPEG, WebP, or GIF images are supported"));
			return;
		}
		cb(null, true);
	},
});

router.get("/categories", async (req, res) => {
	const spaceId = getSpaceId(req);
	if (spaceId === false) {
		res.status(400).json({ error: "spaceId must be a positive integer" });
		return;
	}

	const categories = await listCategories(spaceId);
	res.json({ categories: categories.map(toPublicCategory) });
});

router.get("/documents", async (req, res) => {
	const spaceId = getSpaceId(req);
	if (spaceId === false) {
		res.status(400).json({ error: "spaceId must be a positive integer" });
		return;
	}

	const documents = await listDocuments(spaceId);
	res.json({ documents: documents.map(toPublicDocument) });
});

router.post(
	"/categories",
	validate(createCategorySchema),
	async (req, res) => {
		const { documentId, ...categoryInput } = req.body;
		const category = await createCategory({ ...categoryInput, documentId });

		if (documentId) {
			const assigned = await assignDocumentCategory(documentId, category.id);
			if (!assigned) {
				res.status(404).json({ error: "Document not found" });
				return;
			}
		}

		res.status(201).json({ category: toPublicCategory(category) });
	},
);

export async function analyzePdfUploadHandler(req: Request, res: Response) {
	if (!req.file) {
		res.status(400).json({ error: "PDF file is required" });
		return;
	}

	const minConfidence =
		typeof req.body?.minConfidence === "string"
			? Number(req.body.minConfidence)
			: undefined;
	const analysis = await analyzePdf(
		req.file,
		Number.isFinite(minConfidence) ? minConfidence : undefined,
		getDocumentId(req),
	);

	res.status(analysis.match.needsNewCategory ? 202 : 200).json({
		document: {
			id: analysis.documentId,
			fileName: analysis.fileName,
			sourceType: analysis.sourceType,
			pageCount: analysis.pageCount,
			summary: analysis.summary,
			textPreview: analysis.textPreview,
			model: analysis.model,
		},
		category: analysis.match.category
			? toPublicCategory(analysis.match.category)
			: null,
		confidence: analysis.match.confidence,
		matchedKeywords: analysis.match.matchedKeywords,
		needsNewCategory: analysis.match.needsNewCategory,
		suggestedCategoryName: analysis.match.suggestedCategoryName,
		suggestedCategoryDescription: analysis.match.suggestedCategoryDescription,
		prompt: analysis.match.prompt,
	});
}

export async function analyzeImageUploadHandler(req: Request, res: Response) {
	if (!req.file) {
		res.status(400).json({ error: "Image file is required" });
		return;
	}

	const minConfidence =
		typeof req.body?.minConfidence === "string"
			? Number(req.body.minConfidence)
			: undefined;
	const analysis = await analyzeImage(
		req.file,
		Number.isFinite(minConfidence) ? minConfidence : undefined,
		getDocumentId(req),
	);

	res.status(analysis.match.needsNewCategory ? 202 : 200).json({
		document: {
			id: analysis.documentId,
			fileName: analysis.fileName,
			sourceType: analysis.sourceType,
			pageCount: analysis.pageCount,
			summary: analysis.summary,
			textPreview: analysis.textPreview,
			model: analysis.model,
		},
		category: analysis.match.category
			? toPublicCategory(analysis.match.category)
			: null,
		confidence: analysis.match.confidence,
		matchedKeywords: analysis.match.matchedKeywords,
		needsNewCategory: analysis.match.needsNewCategory,
		suggestedCategoryName: analysis.match.suggestedCategoryName,
		suggestedCategoryDescription: analysis.match.suggestedCategoryDescription,
		prompt: analysis.match.prompt,
	});
}

router.post(
	"/documents/analyze",
	uploadPdfMiddleware.single("file"),
	analyzePdfUploadHandler,
);

router.post(
	"/images/analyze",
	uploadImageMiddleware.single("file"),
	analyzeImageUploadHandler,
);

export default router;

function getDocumentId(req: Request) {
	const documentId =
		typeof req.body?.documentId === "string"
			? Number(req.body.documentId)
			: undefined;

	return typeof documentId === "number" &&
		Number.isInteger(documentId) &&
		documentId > 0
		? documentId
		: undefined;
}

function getSpaceId(req: Request) {
	if (typeof req.query.spaceId !== "string" || req.query.spaceId.trim() === "") {
		return null;
	}

	const spaceId = Number(req.query.spaceId);
	return Number.isInteger(spaceId) && spaceId > 0 ? spaceId : false;
}
