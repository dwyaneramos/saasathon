import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import express, {
	type Request,
	type Response,
	type NextFunction,
} from "express";

import apiRoutes from "./routes/index.js";
import {
	analyzePdfUploadHandler,
	uploadPdfMiddleware,
} from "./routes/documents.js";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
	path: path.resolve(__dirname, "../../.env"),
});

const app = express();
const PORT = process.env.PORT || 3000;
app.use(
	cors({
		origin: "http://localhost:5173",
		credentials: true,
	}),
);

app.use(express.json());
app.use(cors());

app.post("/upload", uploadPdfMiddleware.single("file"), analyzePdfUploadHandler);
app.use("/api/v1", apiRoutes);

app.get("/api/v1/health", (req: Request, res: Response) => {
	res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((req: Request, res: Response) => {
	res.status(404).json({ error: "Not Found" });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	if (err.name === "MulterError" || err.message === "Only PDF files are supported") {
		res.status(400).json({ error: err.message });
		return;
	}

	if (err.message === "Only PNG, JPEG, WebP, or GIF images are supported") {
		res.status(400).json({ error: err.message });
		return;
	}

	if (err.message === "OPENROUTER_API_KEY is required") {
		res.status(503).json({ error: err.message });
		return;
	}

	console.error(err.stack);
	res.status(500).json({ error: "Something went wrong!" });
});

app.listen(PORT, () => {
	console.log(`Server ready at: http://localhost:${PORT}`);
});
