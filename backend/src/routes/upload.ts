import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import multer from "multer";
import { getDb } from "../db/index.js";

const router = express.Router();

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error("Only PDF and image files are allowed."));
  },
});

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
      file: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });
  });
});

router.post("/multiple", (req: Request, res: Response, next: NextFunction) => {
  upload.array("files")(req, res, (err) => {
    if (err) {
      next(err);
      return;
    }

    if (!req.files || req.files.length === 0) {
      res.status(400).json({
        error:
          "No files provided. Use multipart/form-data with field name 'files'.",
      });
      return;
    }

    const files = (req.files as Express.Multer.File[]).map((file) => ({
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    }));

    Promise.all(
      files.map((file) =>
        getDb().query(
          `INSERT INTO documents (filename, file_type, summary, extracted_text, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            file.originalName,
            file.mimeType,
            null,
            null,
            JSON.stringify({ originalName: file.originalName, sizeBytes: file.size }),
          ],
        ),
      ),
    )
      .then(() => {
        res.status(201).json({
          message: `Successfully uploaded ${files.length} file(s).`,
          files,
          totalSize: files.reduce((sum, file) => sum + file.size, 0),
        });
      })
      .catch(next);
  });
});

router.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({
        error: `File is too large. Max size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
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
