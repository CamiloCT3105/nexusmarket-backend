import { Router } from "express";
import { SellerController } from "../controllers/SellerController";

const router = Router();

router.post("/", SellerController.onboard);
router.get("/:userId", SellerController.getByUserId);
router.patch("/:userId/warehouses", SellerController.assignWarehouse);

export default router;