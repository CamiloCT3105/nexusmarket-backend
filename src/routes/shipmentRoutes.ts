import { Router } from "express";
import { ShipmentController } from "../controllers/ShipmentController";

const router = Router();

router.post("/", ShipmentController.create);
router.get("/order/:orderId", ShipmentController.getByOrder);
router.get("/:id", ShipmentController.getById);
router.patch("/:id/status", ShipmentController.updateStatus);

export default router;