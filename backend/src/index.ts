import express, { type Request, type Response } from "express";

const app = express();
const PORT = 3000;

app.get("/", (req: Request, res: Response) => {
	res.send("Hello, TypeScript Express!");
});

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
