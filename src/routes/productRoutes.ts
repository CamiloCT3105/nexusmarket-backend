import { Router } from "express";
import { ProductController } from "../controllers/ProductController";
import { authorize } from "../middlewares/authorize";
import { UserRole } from "../models/User";

const router = Router();

router.post("/", authorize(UserRole.SELLER), ProductController.create);
router.get("/seller/:sellerId", ProductController.getBySeller);
router.get("/:id", ProductController.getById);
router.patch("/:id/variants", authorize(UserRole.SELLER, UserRole.ADMIN), ProductController.addVariant);
router.patch("/:id/status", authorize(UserRole.SELLER, UserRole.ADMIN), ProductController.changeStatus);

export default router;