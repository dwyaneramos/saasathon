import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { HttpError } from "../utils/httpError.js";
import {
	createCategorySchema,
	updateDocumentSchema,
} from "../validation/documents.js";
import {
	askDashboardAssistant,
	analyzeImage,
	analyzePdf,
	assignDocumentCategory,
	createCategory,
	deleteCategory,
	deleteDocument,
	getCategory,
	getDocument,
	listCategories,
	listDocuments,
	renameDocument,
	searchDocuments,
	toPublicCategory,
	toPublicDocument,
	toPublicDocumentSearchResult,
	updateCategory,
	userCanAccessDocument,
	userCanAccessSpace,
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
		if (
			!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
				file.mimetype,
			)
		) {
			cb(new Error("Only PNG, JPEG, WebP, or GIF images are supported"));
			return;
		}
		cb(null, true);
	},
});

router.get("/categories", requireAuth, async (req: AuthRequest, res) => {
	const spaceId = getSpaceId(req);
	if (spaceId === false) {
		res.status(400).json({ error: "spaceId must be a positive integer" });
		return;
	}

	if (
		typeof spaceId === "number" &&
		!(await userCanAccessSpace(spaceId, req.userId!))
	) {
		res.status(404).json({ error: "Space not found" });
		return;
	}

	const categories = await listCategories(spaceId);
	res.json({ categories: categories.map(toPublicCategory) });
});

router.get("/documents", requireAuth, async (req: AuthRequest, res) => {
	const spaceId = getSpaceId(req);
	if (spaceId === false) {
		res.status(400).json({ error: "spaceId must be a positive integer" });
		return;
	}

	const documents = await listDocuments(spaceId, req.userId);
	res.json({ documents: documents.map(toPublicDocument) });
});

router.get("/documents/search", requireAuth, async (req: AuthRequest, res) => {
	const spaceId = getSpaceId(req);
	if (spaceId === false) {
		res.status(400).json({ error: "spaceId must be a positive integer" });
		return;
	}

	const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
	if (!query) {
		res.json({ query: "", documents: [] });
		return;
	}

	const requestedLimit =
		typeof req.query.limit === "string"
			? Number(req.query.limit)
			: undefined;
	const documents = await searchDocuments({
		query,
		spaceId,
		userId: req.userId,
		limit: Number.isInteger(requestedLimit) ? requestedLimit : undefined,
	});

	res.json({
		query,
		documents: documents.map((document) =>
			toPublicDocumentSearchResult(document, query),
		),
		results: documents.map((document) =>
			toPublicDocumentSearchResult(document, query),
		),
	});
});

router.post("/assistant/dashboard", requireAuth, async (req: AuthRequest, res) => {
	const spaceId =
		typeof req.body?.spaceId === "number"
			? req.body.spaceId
			: typeof req.body?.spaceId === "string"
				? Number(req.body.spaceId)
				: null;

	if (spaceId !== null && (!Number.isInteger(spaceId) || spaceId < 1)) {
		res.status(400).json({ error: "spaceId must be a positive integer" });
		return;
	}

	if (
		spaceId !== null &&
		!(await userCanAccessSpace(spaceId, req.userId!))
	) {
		res.status(404).json({ error: "Space not found" });
		return;
	}

	const prompt = typeof req.body?.prompt === "string" ? req.body.prompt : "";
	const pathname =
		typeof req.body?.pathname === "string"
			? req.body.pathname
			: "/dashboard";

	const response = await askDashboardAssistant({
		prompt,
		spaceId,
		pathname,
		userId: req.userId,
	});

	res.json(response);
});

router.get(
	"/documents/:documentId",
	requireAuth,
	async (req: AuthRequest, res) => {
		const documentId = getDocumentIdFromParams(req);
		if (!documentId) {
			res.status(400).json({
				error: "documentId must be a positive integer",
			});
			return;
		}

		if (!(await userCanAccessDocument(documentId, req.userId!))) {
			res.status(404).json({ error: "Document not found" });
			return;
		}

		const document = await getDocument(documentId);
		if (!document) {
			res.status(404).json({ error: "Document not found" });
			return;
		}

		res.json({ document: toPublicDocument(document) });
	},
);

router.patch(
	"/documents/:documentId",
	requireAuth,
	validate(updateDocumentSchema),
	async (req: AuthRequest, res) => {
		const documentId = getDocumentIdFromParams(req);
		if (!documentId) {
			res.status(400).json({
				error: "documentId must be a positive integer",
			});
			return;
		}

		if (!(await userCanAccessDocument(documentId, req.userId!))) {
			res.status(404).json({ error: "Document not found" });
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

router.delete(
	"/documents/:documentId",
	requireAuth,
	async (req: AuthRequest, res) => {
		const documentId = getDocumentIdFromParams(req);
		if (!documentId) {
			res.status(400).json({
				error: "documentId must be a positive integer",
			});
			return;
		}

		if (!(await userCanAccessDocument(documentId, req.userId!))) {
			res.status(404).json({ error: "Document not found" });
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
	},
);

router.get(
	"/documents/:documentId/file",
	requireAuth,
	async (req: AuthRequest, res, next) => {
		const documentId = getDocumentIdFromParams(req);
		if (!documentId) {
			res.status(400).json({
				error: "documentId must be a positive integer",
			});
			return;
		}

		if (!(await userCanAccessDocument(documentId, req.userId!))) {
			res.status(404).json({ error: "Document not found" });
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
		const disposition =
			req.query.download === "1" ? "attachment" : "inline";
		const downloadName = resolveDownloadFilename(displayName, [
			publicDocument.originalFileName,
			publicDocument.storedFileName,
			publicDocument.filename,
			publicDocument.filepath,
		]);

		res.setHeader("Content-Type", publicDocument.mimeType);
		res.setHeader(
			"Content-Disposition",
			`${disposition}; filename="${sanitizeHeaderFilename(downloadName)}"`,
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
	},
);

router.post(
	"/categories",
	requireAuth,
	validate(createCategorySchema),
	async (req: AuthRequest, res) => {
		const { documentId, ...categoryInput } = req.body;
		const spaceId =
			typeof categoryInput.spaceId === "number"
				? categoryInput.spaceId
				: typeof categoryInput.spaceId === "string"
					? Number(categoryInput.spaceId)
					: null;

		if (
			typeof documentId === "number" &&
			!(await userCanAccessDocument(documentId, req.userId!))
		) {
			res.status(404).json({ error: "Document not found" });
			return;
		}

		if (
			spaceId !== null &&
			(!Number.isInteger(spaceId) ||
				spaceId < 1 ||
				!(await userCanAccessSpace(spaceId, req.userId!)))
		) {
			res.status(404).json({ error: "Space not found" });
			return;
		}

		const category = await createCategory({ ...categoryInput, documentId });
		let responseCategory = category;

		if (documentId) {
			const assigned = await assignDocumentCategory(
				documentId,
				category.id,
			);
			if (!assigned) {
				res.status(404).json({ error: "Document not found" });
				return;
			}

			responseCategory = (await getCategory(category.id)) ?? category;
		}

		res.status(201).json({ category: toPublicCategory(responseCategory) });
	},
);

router.patch(
	"/categories/:categoryId",
	requireAuth,
	async (req: AuthRequest, res) => {
		const categoryId = getCategoryIdFromParams(req);
		if (!categoryId) {
			res.status(400).json({
				error: "categoryId must be a positive integer",
			});
			return;
		}

		const category = await getCategory(categoryId);
		if (
			!category ||
			typeof category.space_id !== "number" ||
			!(await userCanAccessSpace(category.space_id, req.userId!))
		) {
			res.status(404).json({ error: "Category not found" });
			return;
		}

		const name =
			typeof req.body?.name === "string" ? req.body.name.trim() : "";
		const hasDescription = Object.hasOwn(req.body ?? {}, "description");
		const description =
			typeof req.body?.description === "string"
				? req.body.description.trim()
				: null;

		if (!name || name.length > 80) {
			res.status(400).json({
				error: "Category name must be 1-80 characters",
			});
			return;
		}

		const updatedCategory = await updateCategory(categoryId, {
			name,
			...(hasDescription ? { description } : {}),
		});
		if (!updatedCategory) {
			res.status(404).json({ error: "Category not found" });
			return;
		}

		res.json({ category: toPublicCategory(updatedCategory) });
	},
);

router.delete(
	"/categories/:categoryId",
	requireAuth,
	async (req: AuthRequest, res) => {
		const categoryId = getCategoryIdFromParams(req);
		if (!categoryId) {
			res.status(400).json({
				error: "categoryId must be a positive integer",
			});
			return;
		}

		const category = await getCategory(categoryId);
		if (
			!category ||
			typeof category.space_id !== "number" ||
			!(await userCanAccessSpace(category.space_id, req.userId!))
		) {
			res.status(404).json({ error: "Category not found" });
			return;
		}

		const deletedCategory = await deleteCategory(categoryId);
		if (!deletedCategory) {
			res.status(404).json({ error: "Category not found" });
			return;
		}

		res.json({
			success: true,
			category: toPublicCategory(deletedCategory),
		});
	},
);

async function getRequestedCategory(req: AuthRequest) {
	const rawCategoryId = req.body?.categoryId;
	if (!rawCategoryId) {
		return null;
	}

	const categoryId = Number(rawCategoryId);
	if (!Number.isInteger(categoryId) || categoryId < 1) {
		throw new HttpError(400, "categoryId must be a positive integer");
	}

	const category = await getCategory(categoryId);
	if (!category) {
		throw new HttpError(404, "Category not found");
	}

	if (
		typeof category.space_id !== "number" ||
		!(await userCanAccessSpace(category.space_id, req.userId!))
	) {
		throw new HttpError(404, "Category not found");
	}

	return category;
}

async function applyRequestedCategory(
	documentId: number,
	category: Awaited<ReturnType<typeof getCategory>> | null,
) {
	if (!category) {
		return null;
	}

	await assignDocumentCategory(documentId, category.id);
	return category;
}

export async function analyzePdfUploadHandler(req: AuthRequest, res: Response) {
	if (!req.file) {
		res.status(400).json({ error: "PDF file is required" });
		return;
	}

	const minConfidence =
		typeof req.body?.minConfidence === "string"
			? Number(req.body.minConfidence)
			: undefined;
	const documentId = getDocumentId(req);
	if (
		documentId &&
		!(await userCanAccessDocument(documentId, req.userId!))
	) {
		res.status(404).json({ error: "Document not found" });
		return;
	}

	const requestedCategory = await getRequestedCategory(req);
	const existingDocument = documentId ? await getDocument(documentId) : null;
	if (
		requestedCategory &&
		existingDocument &&
		requestedCategory.space_id !== existingDocument.space_id
	) {
		res.status(400).json({ error: "Category does not belong to this space" });
		return;
	}
	const analysis = await analyzePdf(
		req.file,
		Number.isFinite(minConfidence) ? minConfidence : undefined,
		documentId,
	);
	const assignedCategory = await applyRequestedCategory(
		analysis.documentId,
		requestedCategory,
	);
	const responseCategory = assignedCategory ?? analysis.match.category;
	const needsNewCategory = assignedCategory
		? false
		: analysis.match.needsNewCategory;

	res.status(needsNewCategory ? 202 : 200).json({
		document: {
			id: analysis.documentId,
			fileName: analysis.fileName,
			sourceType: analysis.sourceType,
			pageCount: analysis.pageCount,
			summary: analysis.summary,
			textPreview: analysis.textPreview,
			model: analysis.model,
		},
		category: responseCategory ? toPublicCategory(responseCategory) : null,
		confidence: assignedCategory ? 1 : analysis.match.confidence,
		matchedKeywords: assignedCategory ? [] : analysis.match.matchedKeywords,
		needsNewCategory,
		suggestedCategoryName: assignedCategory
			? assignedCategory.name
			: analysis.match.suggestedCategoryName,
		suggestedCategoryDescription: assignedCategory
			? assignedCategory.description
			: analysis.match.suggestedCategoryDescription,
		prompt: assignedCategory ? null : analysis.match.prompt,
	});
}

export async function analyzeImageUploadHandler(req: AuthRequest, res: Response) {
	if (!req.file) {
		res.status(400).json({ error: "Image file is required" });
		return;
	}

	const minConfidence =
		typeof req.body?.minConfidence === "string"
			? Number(req.body.minConfidence)
			: undefined;
	const documentId = getDocumentId(req);
	if (
		documentId &&
		!(await userCanAccessDocument(documentId, req.userId!))
	) {
		res.status(404).json({ error: "Document not found" });
		return;
	}

	const requestedCategory = await getRequestedCategory(req);
	const existingDocument = documentId ? await getDocument(documentId) : null;
	if (
		requestedCategory &&
		existingDocument &&
		requestedCategory.space_id !== existingDocument.space_id
	) {
		res.status(400).json({ error: "Category does not belong to this space" });
		return;
	}
	const analysis = await analyzeImage(
		req.file,
		Number.isFinite(minConfidence) ? minConfidence : undefined,
		documentId,
	);
	const assignedCategory = await applyRequestedCategory(
		analysis.documentId,
		requestedCategory,
	);
	const responseCategory = assignedCategory ?? analysis.match.category;
	const needsNewCategory = assignedCategory
		? false
		: analysis.match.needsNewCategory;

	res.status(needsNewCategory ? 202 : 200).json({
		document: {
			id: analysis.documentId,
			fileName: analysis.fileName,
			sourceType: analysis.sourceType,
			pageCount: analysis.pageCount,
			summary: analysis.summary,
			textPreview: analysis.textPreview,
			model: analysis.model,
		},
		category: responseCategory ? toPublicCategory(responseCategory) : null,
		confidence: assignedCategory ? 1 : analysis.match.confidence,
		matchedKeywords: assignedCategory ? [] : analysis.match.matchedKeywords,
		needsNewCategory,
		suggestedCategoryName: assignedCategory
			? assignedCategory.name
			: analysis.match.suggestedCategoryName,
		suggestedCategoryDescription: assignedCategory
			? assignedCategory.description
			: analysis.match.suggestedCategoryDescription,
		prompt: assignedCategory ? null : analysis.match.prompt,
	});
}

router.post(
	"/documents/analyze",
	requireAuth,
	uploadPdfMiddleware.single("file"),
	analyzePdfUploadHandler,
);

router.post(
	"/images/analyze",
	requireAuth,
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
	if (
		typeof req.query.spaceId !== "string" ||
		req.query.spaceId.trim() === ""
	) {
		return null;
	}

	const spaceId = Number(req.query.spaceId);
	return Number.isInteger(spaceId) && spaceId > 0 ? spaceId : false;
}

function getDocumentIdFromParams(req: Request) {
	const documentId = Number(req.params.documentId);
	return Number.isInteger(documentId) && documentId > 0 ? documentId : null;
}

function getCategoryIdFromParams(req: Request) {
	const categoryId = Number(req.params.categoryId);
	return Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null;
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

function resolveDownloadFilename(
	displayName: string,
	fallbackNames: Array<string | null | undefined>,
) {
	const trimmedDisplayName = displayName.trim();
	if (path.extname(trimmedDisplayName)) {
		return trimmedDisplayName;
	}

	for (const fallbackName of fallbackNames) {
		if (!fallbackName) {
			continue;
		}

		const extension = path.extname(path.basename(fallbackName.trim()));
		if (extension) {
			return `${trimmedDisplayName}${extension}`;
		}
	}

	return trimmedDisplayName;
}
