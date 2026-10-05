import { Router } from "express";
import { ProductController } from "../controllers/ProductController";

const router = Router();

router.post("/", ProductController.create);
router.get("/:id", ProductController.getById);
router.get("/seller/:sellerId", ProductController.getBySeller);
router.patch("/:id/variants", ProductController.addVariant);
router.patch("/:id/status", ProductController.changeStatus);

export default router;