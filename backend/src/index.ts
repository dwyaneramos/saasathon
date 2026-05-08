import dotenv from "dotenv";
dotenv.config();

import express, {
	type Request,
	type Response,
	type NextFunction,
} from "express";
import apiRoutes from "./routes/index.js";

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
