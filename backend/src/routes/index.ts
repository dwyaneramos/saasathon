import { Router } from "express";
import uploadRoutes from "./upload.js";
import userRoutes from "./users.js";
import documentRoutes from "./documents.js";

const router = Router();

router.use("/users", userRoutes);
router.use("/upload", uploadRoutes);
router.use("/", documentRoutes);

export default router;
