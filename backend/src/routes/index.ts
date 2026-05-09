import { Router } from "express";
import uploadRoutes from "./upload.js";
import userRoutes from "./users.js";

const router = Router();

router.use("/users", userRoutes);
router.use("/upload", uploadRoutes);

export default router;
