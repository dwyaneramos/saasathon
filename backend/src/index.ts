import express, {
	type Request,
	type Response,
	type NextFunction,
} from "express";
import cors from "cors";
import uploadRoutes from "./routes/upload.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.get("/", (req: Request, res: Response) => {
	res.json({ message: "Server is running with ESM and TypeScript!" });
});

// Upload routes
app.use("/upload", uploadRoutes);

// Example Route for testing extensions
// import { apiRouter } from './routes/api.js';
// app.use('/api', apiRouter);

// 404 Handler
app.use((req: Request, res: Response) => {
	res.status(404).json({ error: "Not Found" });
});

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	console.error(err.stack);
	res.status(500).json({ error: "Something went wrong!" });
});

app.listen(PORT, () => {
	console.log(`🚀 Server ready at: http://localhost:${PORT}`);
});
