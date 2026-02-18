import { Router } from "express";
import { projectRoutes } from "../../modules/project/routes";
import authRoutes from "../../modules/auth/routes/auth.routes";
// import { authenticate, authorize } from "../../middlewares/authMiddleware";


const router = Router();

// Mount auth routes
router.use("/auth", authRoutes);

// Mount project routes
router.use("/projects", projectRoutes);

export default router;
