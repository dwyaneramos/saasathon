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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, "../../upload");

const router = express.Router();

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
	storage: multer.diskStorage({
		destination: async (_req, _file, cb) => {
			try {
				await fs.mkdir(uploadDir, { recursive: true });
				cb(null, uploadDir);
			} catch (err) {
				cb(err as Error, uploadDir);
			}
		},
		filename: (_req, file, cb) => {
			cb(null, safeFilename(file.originalname));
		},
	}),
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

function uploadedFileResponse(file: Express.Multer.File) {
	return {
		originalName: file.originalname,
		filename: file.filename,
		mimeType: file.mimetype,
		size: file.size,
		path: `backend/upload/${file.filename}`,
	};
}

function resolveUploadPath(filename: string) {
	const normalizedFilename = path.basename(filename);

	if (normalizedFilename !== filename || !normalizedFilename) {
		return null;
	}

	return path.join(uploadDir, normalizedFilename);
}

router.post("/", (req: Request, res: Response, next: NextFunction) => {
	upload.single("file")(req, res, (err) => {
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

		res.status(201).json({
			message: "File uploaded successfully.",
			file: uploadedFileResponse(req.file),
		});
	});
});

router.post("/multiple", (req: Request, res: Response, next: NextFunction) => {
	upload.array("files", MAX_FILES)(req, res, (err) => {
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

		res.status(201).json({
			message: `Successfully uploaded ${files.length} file(s).`,
			files: files.map(uploadedFileResponse),
			totalSize: files.reduce((sum, file) => sum + file.size, 0),
		});
	});
});

router.delete("/:filename", async (req: Request, res: Response, next: NextFunction) => {
	const filename =
		typeof req.params.filename === "string" ? req.params.filename : null;

	if (!filename) {
		res.status(400).json({ error: "Invalid filename." });
		return;
	}

	const filePath = resolveUploadPath(filename);

	if (!filePath) {
		res.status(400).json({ error: "Invalid filename." });
		return;
	}

	try {
		await fs.unlink(filePath);
		res.json({
			message: "File deleted successfully.",
			filename,
		});
	} catch (err) {
		if (
			err &&
			typeof err === "object" &&
			"code" in err &&
			err.code === "ENOENT"
		) {
			res.status(404).json({ error: "File not found." });
			return;
		}

		next(err);
	}
});

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
