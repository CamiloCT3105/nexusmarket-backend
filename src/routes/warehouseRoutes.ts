import { Router } from "express";
import { WarehouseController } from "../controllers/WarehouseController";

const router = Router();

router.post("/", WarehouseController.create);
router.get("/:id", WarehouseController.getById);
router.get("/seller/:sellerId", WarehouseController.getBySeller);
router.patch("/:id/link-seller", WarehouseController.linkToSeller);

export default router;