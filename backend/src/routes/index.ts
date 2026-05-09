import { Router } from "express";
import userRoutes from "./users.js";
import documentRoutes from "./documents.js";

const router = Router();

router.use("/users", userRoutes);
router.use("/", documentRoutes);

export default router;
