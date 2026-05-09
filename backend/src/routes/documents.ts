import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
	createCategorySchema,
	updateDocumentSchema,
} from "../validation/documents.js";
import {
	analyzeImage,
	analyzePdf,
	assignDocumentCategory,
	createCategory,
	deleteDocument,
	getDocument,
	listCategories,
	listDocuments,
	renameDocument,
	toPublicCategory,
	toPublicDocument,
} from "../services/documentAnalyzer.js";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "../../..");
const uploadRoot = path.join(workspaceRoot, "backend/upload");
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

router.get("/documents/:documentId", async (req, res) => {
	const documentId = getDocumentIdFromParams(req);
	if (!documentId) {
		res.status(400).json({ error: "documentId must be a positive integer" });
		return;
	}

	const document = await getDocument(documentId);
	if (!document) {
		res.status(404).json({ error: "Document not found" });
		return;
	}

	res.json({ document: toPublicDocument(document) });
});

router.patch(
	"/documents/:documentId",
	requireAuth,
	validate(updateDocumentSchema),
	async (req, res) => {
		const documentId = getDocumentIdFromParams(req);
		if (!documentId) {
			res.status(400).json({ error: "documentId must be a positive integer" });
			return;
		}

		const document = await renameDocument(documentId, req.body.name);
		if (!document) {
			res.status(404).json({ error: "Document not found" });
			return;
		}

		res.json({ document: toPublicDocument(document) });
	},
);

router.delete("/documents/:documentId", requireAuth, async (req, res) => {
	const documentId = getDocumentIdFromParams(req);
	if (!documentId) {
		res.status(400).json({ error: "documentId must be a positive integer" });
		return;
	}

	const document = await deleteDocument(documentId);
	if (!document) {
		res.status(404).json({ error: "Document not found" });
		return;
	}

	if (document.filepath) {
		const filePath = resolveStoredFilePath(document.filepath);
		if (filePath) {
			try {
				await fs.promises.unlink(filePath);
			} catch (error) {
				if (!isNotFoundError(error)) {
					throw error;
				}
			}
		}
	}

	res.json({ success: true });
});

router.get("/documents/:documentId/file", async (req, res, next) => {
	const documentId = getDocumentIdFromParams(req);
	if (!documentId) {
		res.status(400).json({ error: "documentId must be a positive integer" });
		return;
	}

	const document = await getDocument(documentId);
	if (!document) {
		res.status(404).json({ error: "Document not found" });
		return;
	}

	if (!document.filepath) {
		res.status(404).json({ error: "Stored file not found" });
		return;
	}

	const filePath = resolveStoredFilePath(document.filepath);
	if (!filePath) {
		res.status(400).json({ error: "Invalid stored file path" });
		return;
	}

	try {
		await fs.promises.access(filePath, fs.constants.R_OK);
	} catch {
		res.status(404).json({ error: "Stored file not found" });
		return;
	}

	const publicDocument = toPublicDocument(document);
	const displayName =
		publicDocument.originalFileName ??
		publicDocument.fileName ??
		publicDocument.filename;
	const disposition = req.query.download === "1" ? "attachment" : "inline";

	res.setHeader("Content-Type", publicDocument.mimeType);
	res.setHeader(
		"Content-Disposition",
		`${disposition}; filename="${sanitizeHeaderFilename(displayName)}"`,
	);

	res.sendFile(filePath, (err) => {
		if (!err) {
			return;
		}

		if (
			err.message === "Request aborted" ||
			(err as NodeJS.ErrnoException).code === "ECONNABORTED" ||
			res.headersSent
		) {
			return;
		}

		next(err);
	});
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

function getDocumentIdFromParams(req: Request) {
	const documentId = Number(req.params.documentId);
	return Number.isInteger(documentId) && documentId > 0 ? documentId : null;
}

function resolveStoredFilePath(filepath: string) {
	const normalizedPath = path.normalize(filepath);
	if (
		path.isAbsolute(normalizedPath) ||
		(!normalizedPath.startsWith("backend/upload/") &&
			!normalizedPath.startsWith("backend\\upload\\"))
	) {
		return null;
	}

	const filePath = path.resolve(workspaceRoot, normalizedPath);
	const relativeToUploadRoot = path.relative(uploadRoot, filePath);
	if (
		relativeToUploadRoot.startsWith("..") ||
		path.isAbsolute(relativeToUploadRoot)
	) {
		return null;
	}

	return filePath;
}

function sanitizeHeaderFilename(filename: string) {
	return filename.replace(/["\r\n]/g, "_");
}

function isNotFoundError(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "ENOENT"
	);
}
