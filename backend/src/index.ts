import express, {
	type Request,
	type Response,
	type NextFunction,
} from "express";
import dotenv from "dotenv";
dotenv.config();
import userRoutes from "./routes/users.js";

const app = express();

const PORT = process.env.PORT || 3000;
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
	res.json({ message: "Server is running with ESM and TypeScript!" });
});

app.use((req: Request, res: Response) => {
	res.status(404).json({ error: "Not Found" });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	console.error(err.stack);
	res.status(500).json({ error: "Something went wrong!" });
});

app.use("/users", userRoutes);

app.listen(PORT, () => {
	console.log(`🚀 Server ready at: http://localhost:${PORT}`);
});
