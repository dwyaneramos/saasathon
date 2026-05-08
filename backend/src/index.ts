import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
	path: path.resolve(__dirname, "../../.env"),
});

import express, {
	type Request,
	type Response,
	type NextFunction,
} from "express";
import apiRoutes from "./routes/index.js";
import listEndpoints from "express-list-endpoints"; // npm install express-list-endpoints

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use("/api/v1", apiRoutes);

app.get("/api/v1/health", (req: Request, res: Response) => {
	res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((req: Request, res: Response) => {
	res.status(404).json({ error: "Not Found" });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	console.error(err.stack);
	res.status(500).json({ error: "Something went wrong!" });
});

app.listen(PORT, () => {
	console.log(`Server ready at: http://localhost:${PORT}`);
});
