import type { Request, Response } from "express";
import multer from "multer";
import {
	analyzeImage,
	analyzePdf,
	assignDocumentCategory,
	createCategory,
	listCategories,
	listCategoryConnections,
	toPublicCategory,
	toPublicCategoryConnection,
	type DocumentAnalysis,
} from "../services/documentAnalyzer.js";

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

export async function getCategories(req: Request, res: Response) {
	const spaceId = getQuerySpaceId(req);
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
}

export async function postCategory(req: Request, res: Response) {
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
}

export async function analyzePdfUpload(req: Request, res: Response) {
	if (!req.file) {
		res.status(400).json({ error: "PDF file is required" });
		return;
	}

	const analysis = await analyzePdf(
		req.file,
		getMinConfidence(req),
		getDocumentId(req),
	);
	sendAnalysisResponse(res, analysis);
}

export async function analyzeImageUpload(req: Request, res: Response) {
	if (!req.file) {
		res.status(400).json({ error: "Image file is required" });
		return;
	}

	const analysis = await analyzeImage(
		req.file,
		getMinConfidence(req),
		getDocumentId(req),
	);
	sendAnalysisResponse(res, analysis);
}

function getMinConfidence(req: Request) {
	const minConfidence =
		typeof req.body?.minConfidence === "string"
			? Number(req.body.minConfidence)
			: undefined;

	return Number.isFinite(minConfidence) ? minConfidence : undefined;
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

function getQuerySpaceId(req: Request) {
	const rawSpaceId = req.query.spaceId;
	if (typeof rawSpaceId !== "string" || rawSpaceId.trim() === "") {
		return null;
	}

	const spaceId = Number(rawSpaceId);
	return Number.isInteger(spaceId) && spaceId > 0 ? spaceId : false;
}

function sendAnalysisResponse(res: Response, analysis: DocumentAnalysis) {
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
