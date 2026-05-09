import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express, {
	type NextFunction,
	type Request,
	type Response,
} from "express";
import multer from "multer";
import { getDb } from "../db/index.js";
import {
	ensureSpaceExists,
	getOrCreateDefaultSpace,
} from "../services/spaceService.js";
import { HttpError } from "../utils/httpError.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, "../../upload");

const router = express.Router({ mergeParams: true });

const MAX_FILES = 10;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const allowedMimeTypes = new Set([
	"application/pdf",
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/svg+xml",
	"image/bmp",
	"image/tiff",
]);

function safeFilename(originalName: string) {
	const ext = path.extname(originalName).toLowerCase();
	const base = path
		.basename(originalName, ext)
		.normalize("NFKD")
		.replace(/[^\w.-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);

	return `${Date.now()}-${randomUUID()}-${base || "document"}${ext}`;
}

const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: MAX_FILE_SIZE_BYTES,
		files: MAX_FILES,
	},
	fileFilter: (_req, file, cb) => {
		if (allowedMimeTypes.has(file.mimetype)) {
			cb(null, true);
			return;
		}

		cb(new Error("Only PDF and image files are allowed."));
	},
});

type StoredUpload = {
	documentId: number;
	spaceId: number;
	originalName: string;
	filename: string;
	mimeType: string;
	size: number;
	path: string;
};

function uploadedFileResponse(file: StoredUpload) {
	return {
		documentId: file.documentId,
		spaceId: file.spaceId,
		originalName: file.originalName,
		filename: file.filename,
		mimeType: file.mimeType,
		size: file.size,
		path: file.path,
	};
}

router.post("/", (req: Request, res: Response, next: NextFunction) => {
	upload.single("file")(req, res, async (err) => {
		if (err) {
			next(err);
			return;
		}

		if (!req.file) {
			res.status(400).json({
				error:
					"No file provided. Use multipart/form-data with field name 'file'.",
			});
			return;
		}

		try {
			const storedFile = await storeUploadedFile(req, req.file);
			res.status(201).json({
				message: "File uploaded successfully.",
				file: uploadedFileResponse(storedFile),
			});
		} catch (err) {
			next(err);
		}
	});
});

router.post("/multiple", (req: Request, res: Response, next: NextFunction) => {
	upload.array("files", MAX_FILES)(req, res, async (err) => {
		if (err) {
			next(err);
			return;
		}

		const files = Array.isArray(req.files) ? req.files : [];

		if (files.length === 0) {
			res.status(400).json({
				error:
					"No files provided. Use multipart/form-data with field name 'files'.",
			});
			return;
		}

		try {
			const storedFiles = [];
			for (const file of files) {
				storedFiles.push(await storeUploadedFile(req, file));
			}

			res.status(201).json({
				message: `Successfully uploaded ${storedFiles.length} file(s).`,
				files: storedFiles.map(uploadedFileResponse),
				totalSize: storedFiles.reduce((sum, file) => sum + file.size, 0),
			});
		} catch (err) {
			next(err);
		}
	});
});

async function resolveSpace(req: Request) {
	const rawSpaceId =
		req.params.spaceId ??
		req.body?.spaceId ??
		req.query?.spaceId;

	if (!rawSpaceId) {
		return getOrCreateDefaultSpace();
	}

	const spaceId = Number(rawSpaceId);
	if (!Number.isInteger(spaceId) || spaceId < 1) {
		throw new HttpError(400, "spaceId must be a positive integer");
	}

	const space = await ensureSpaceExists(spaceId);
	if (!space) {
		throw new HttpError(404, "Space not found");
	}

	return space;
}

async function storeUploadedFile(req: Request, file: Express.Multer.File) {
	const space = await resolveSpace(req);
	const filename = safeFilename(file.originalname);
	const spaceDir = path.join(uploadDir, `space-${space.id}`);
	const absolutePath = path.join(spaceDir, filename);
	const storagePath = `backend/upload/space-${space.id}/${filename}`;

	await fs.mkdir(spaceDir, { recursive: true });
	await fs.writeFile(absolutePath, file.buffer);

	const { rows } = await getDb().query<{ id: number }>(
		`INSERT INTO documents (
			space_id,
			file_name,
			original_file_name,
			stored_file_name,
			storage_path,
			mime_type,
			file_size,
			extracted_text,
			summary
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, '', '')
		RETURNING id`,
		[
			space.id,
			file.originalname,
			file.originalname,
			filename,
			storagePath,
			file.mimetype,
			file.size,
		],
	);

	return {
		documentId: rows[0].id,
		spaceId: space.id,
		originalName: file.originalname,
		filename,
		mimeType: file.mimetype,
		size: file.size,
		path: storagePath,
	};
}

router.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
	if (err instanceof multer.MulterError) {
		if (err.code === "LIMIT_FILE_SIZE") {
			res.status(400).json({
				error: `File is too large. Max size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
			});
			return;
		}

		if (err.code === "LIMIT_FILE_COUNT") {
			res.status(400).json({
				error: `Too many files. Max count is ${MAX_FILES}.`,
			});
			return;
		}

		res.status(400).json({ error: err.message });
		return;
	}

	if (err.message === "Only PDF and image files are allowed.") {
		res.status(400).json({ error: err.message });
		return;
	}

	next(err);
});

export default router;
