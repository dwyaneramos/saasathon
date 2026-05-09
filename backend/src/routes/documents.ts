import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { HttpError } from "../utils/httpError.js";
import { createZipArchive, type ZipArchiveFile } from "../utils/zip.js";
import {
	createCategorySchema,
	updateCategorySchema,
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
	findDocumentsForDownloadCriteria,
	getCategory,
	getDocument,
	listCategories,
	listCategoryConnections,
	listDocuments,
	listDocumentsForCategory,
	renameDocument,
	searchDocuments,
	toPublicCategory,
	toPublicCategoryConnection,
	toPublicDocument,
	toPublicDocumentSearchResult,
	updateCategory,
	userCanAccessDocument,
	userCanAccessSpace,
	type DownloadableDocumentRow,
} from "../services/documentAnalyzer.js";
import { userCanAccessSpace } from "../services/spaceService.js";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "../../..");
const uploadRoot = path.join(workspaceRoot, "backend/upload");
const ARCHIVE_NAME_STOPWORDS = new Set([
	"a",
	"all",
	"an",
	"and",
	"any",
	"category",
	"download",
	"document",
	"documents",
	"done",
	"export",
	"file",
	"files",
	"for",
	"from",
	"give",
	"in",
	"matching",
	"me",
	"of",
	"on",
	"or",
	"please",
	"save",
	"that",
	"the",
	"these",
	"to",
	"with",
	"zip",
]);
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

router.get("/categories", async (req, res) => {
	const spaceId = getSpaceId(req);
	if (spaceId === false) {
		res.status(400).json({ error: "spaceId must be a positive integer" });
		return;
	}

	const [categories, connections] = await Promise.all([
		listCategories(spaceId),
		listCategoryConnections(spaceId),
	]);
	res.json({
		categories: categories.map(toPublicCategory),
		connections: connections.map(toPublicCategoryConnection),
	});
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

router.get("/documents/search", async (req, res) => {
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
		limit: Number.isInteger(requestedLimit) ? requestedLimit : undefined,
	});

	res.json({
		query,
		documents: documents.map(toPublicDocumentSearchResult),
		results: documents.map(toPublicDocumentSearchResult),
	});
});

router.post(
	"/documents/download-query",
	requireAuth,
	async (req: AuthRequest, res) => {
		const spaceId =
			typeof req.body?.spaceId === "number"
				? req.body.spaceId
				: typeof req.body?.spaceId === "string"
					? Number(req.body.spaceId)
					: null;

		if (spaceId !== null && (!Number.isInteger(spaceId) || spaceId < 1)) {
			res.status(400).json({
				error: "spaceId must be a positive integer",
			});
			return;
		}

		if (
			spaceId !== null &&
			!(await userCanAccessSpace(spaceId, req.userId!))
		) {
			res.status(404).json({ error: "Space not found" });
			return;
		}

		const query =
			typeof req.body?.query === "string" ? req.body.query.trim() : "";
		if (!query) {
			res.status(400).json({ error: "Tell Kibi what files to download." });
			return;
		}

		const documents = await findDocumentsForDownloadCriteria({
			query,
			spaceId,
			userId: req.userId,
			limit: 100,
		});

		await sendDocumentsArchive(
			res,
			documents,
			resolveCriteriaArchiveName(query, documents),
			"No files matched that download request.",
		);
	},
);

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

	const prompt = typeof req.body?.prompt === "string" ? req.body.prompt : "";
	const pathname =
		typeof req.body?.pathname === "string"
			? req.body.pathname
			: "/dashboard";

	const response = await askDashboardAssistant({
		prompt,
		spaceId,
		pathname,
	});

	res.json(response);
});

router.get(
	"/categories/:categoryId/download",
	requireAuth,
	async (req: AuthRequest, res) => {
		const categoryId = getCategoryIdFromParams(req);
		if (!categoryId) {
			res.status(400).json({
				error: "categoryId must be a positive integer",
			});
			return;
		}

		const spaceId = getSpaceId(req);
		if (spaceId === false) {
			res.status(400).json({
				error: "spaceId must be a positive integer",
			});
			return;
		}

		const category = await getCategory(categoryId);
		if (
			!category ||
			typeof category.space_id !== "number" ||
			!(await userCanAccessSpace(category.space_id, req.userId!)) ||
			(typeof spaceId === "number" && category.space_id !== spaceId)
		) {
			res.status(404).json({ error: "Category not found" });
			return;
		}

		const documents = await listDocumentsForCategory({
			categoryId,
			spaceId: category.space_id,
			userId: req.userId,
		});

		await sendDocumentsArchive(
			res,
			documents,
			`${category.name}.zip`,
			"No files found in this category.",
		);
	},
);

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
			res.status(400).json({
				error: "documentId must be a positive integer",
			});
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
		res.status(400).json({
			error: "documentId must be a positive integer",
		});
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
		res.status(400).json({
			error: "documentId must be a positive integer",
		});
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
});

router.post("/categories", validate(createCategorySchema), async (req, res) => {
	const { documentId, ...categoryInput } = req.body;
	const category = await createCategory({ ...categoryInput, documentId });
	let responseCategory = category;

	if (documentId) {
		const assigned = await assignDocumentCategory(documentId, category.id);
		if (!assigned) {
			res.status(404).json({ error: "Document not found" });
			return;
		}

			responseCategory = (await getCategory(category.id)) ?? category;
		}

	res.status(201).json({ category: toPublicCategory(responseCategory) });
});

router.patch(
	"/categories/:categoryId",
	requireAuth,
	validate(updateCategorySchema),
	async (req: AuthRequest, res) => {
		const categoryId = getCategoryIdFromParams(req);
		if (!categoryId) {
			res.status(400).json({ error: "categoryId must be a positive integer" });
			return;
		}

		const category = await getManageableCategory(req, categoryId);
		if (!category) {
			res.status(404).json({ error: "Category not found" });
			return;
		}

		const updatedCategory = await updateCategory(categoryId, {
			name: req.body.name,
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
			res.status(400).json({ error: "categoryId must be a positive integer" });
			return;
		}

		const category = await getManageableCategory(req, categoryId);
		if (!category) {
			res.status(404).json({ error: "Category not found" });
			return;
		}

		const deletedCategory = await deleteCategory(categoryId);
		if (!deletedCategory) {
			res.status(404).json({ error: "Category not found" });
			return;
		}

		res.json({ success: true, category: toPublicCategory(deletedCategory) });
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
		suggestedCategoryDescription:
			analysis.match.suggestedCategoryDescription,
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
		suggestedCategoryDescription:
			analysis.match.suggestedCategoryDescription,
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

async function sendDocumentsArchive(
	res: Response,
	documents: DownloadableDocumentRow[],
	archiveName: string,
	emptyMessage: string,
) {
	const files = await readArchiveFiles(documents);

	if (files.length === 0) {
		res.status(404).json({ error: emptyMessage });
		return;
	}

	const archive = createZipArchive(files);
	const safeArchiveName = sanitizeHeaderFilename(
		archiveName.endsWith(".zip") ? archiveName : `${archiveName}.zip`,
	);

	res.setHeader("Content-Type", "application/zip");
	res.setHeader(
		"Content-Disposition",
		`attachment; filename="${safeArchiveName}"`,
	);
	res.setHeader("Content-Length", String(archive.length));
	res.setHeader("X-File-Count", String(files.length));
	res.setHeader(
		"Access-Control-Expose-Headers",
		"Content-Disposition, X-File-Count",
	);
	res.send(archive);
}

async function readArchiveFiles(documents: DownloadableDocumentRow[]) {
	const files: ZipArchiveFile[] = [];
	const usedNames = new Set<string>();

	for (const document of documents) {
		if (!document.filepath) {
			continue;
		}

		const filePath = resolveStoredFilePath(document.filepath);
		if (!filePath) {
			continue;
		}

		try {
			const data = await fs.promises.readFile(filePath);
			files.push({
				name: uniqueArchiveEntryName(
					resolveArchiveEntryName(document),
					usedNames,
				),
				data,
				modifiedAt: document.created_at,
			});
		} catch (error) {
			if (!isNotFoundError(error)) {
				throw error;
			}
		}
	}

	return files;
}

function resolveArchiveEntryName(document: DownloadableDocumentRow) {
	const displayName =
		document.original_file_name ??
		document.file_name ??
		document.filename ??
		`document-${document.id}`;
	const filename = resolveDownloadFilename(displayName, [
		document.original_file_name,
		document.stored_file_name,
		document.filename,
		document.filepath,
	]);
	const basename = path.basename(filename).replace(/[\r\n]/g, "_").trim();

	return basename || `document-${document.id}`;
}

function uniqueArchiveEntryName(filename: string, usedNames: Set<string>) {
	const extension = path.extname(filename);
	const stem = extension ? filename.slice(0, -extension.length) : filename;
	let candidate = filename;
	let index = 2;

	while (usedNames.has(candidate.toLowerCase())) {
		candidate = `${stem} (${index})${extension}`;
		index += 1;
	}

	usedNames.add(candidate.toLowerCase());
	return candidate;
}

function resolveCriteriaArchiveName(
	query: string,
	documents: DownloadableDocumentRow[],
) {
	const sharedCategoryName = getSharedCategoryName(documents);
	const queryTokens = archiveNameTokens(query);

	if (sharedCategoryName) {
		const categoryTokens = new Set(archiveNameTokens(sharedCategoryName));
		const remainingTokens = queryTokens
			.filter((token) => !categoryTokens.has(token))
			.slice(0, 3);

		return `${archiveNameSlug([sharedCategoryName, ...remainingTokens])}.zip`;
	}

	return `${archiveNameSlug(queryTokens.length > 0 ? queryTokens : ["files"])}.zip`;
}

function getSharedCategoryName(documents: DownloadableDocumentRow[]) {
	const categoryNames = documents
		.map((document) => document.category_name?.trim())
		.filter((name): name is string => Boolean(name));

	if (categoryNames.length === 0) {
		return null;
	}

	const normalizedNames = new Set(
		categoryNames.map((name) => name.toLowerCase()),
	);
	return normalizedNames.size === 1 ? categoryNames[0] : null;
}

function archiveNameTokens(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, " ")
		.split(/[\s-]+/)
		.map((token) => token.trim())
		.filter((token) => token.length >= 2)
		.filter((token) => !ARCHIVE_NAME_STOPWORDS.has(token))
		.slice(0, 6);
}

function archiveNameSlug(parts: string[]) {
	const slug = parts
		.join("-")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 72)
		.replace(/-+$/g, "");

	return slug || "files";
}

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

function getCategoryIdFromParams(req: Request) {
	const categoryId = Number(req.params.categoryId);
	return Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null;
}

async function getManageableCategory(req: AuthRequest, categoryId: number) {
	const category = await getCategory(categoryId);
	if (!category || typeof category.space_id !== "number" || !req.userId) {
		return null;
	}

	return (await userCanAccessSpace(req.userId, category.space_id))
		? category
		: null;
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
