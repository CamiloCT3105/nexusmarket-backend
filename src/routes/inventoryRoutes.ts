import { Router } from "express";
import { InventoryController } from "../controllers/InventoryController";

const router = Router();

router.post("/inbound", InventoryController.registerInbound);
router.post("/reserve", InventoryController.reserveStock);
router.post("/outbound", InventoryController.confirmOutbound);
router.post("/damaged", InventoryController.markAsDamaged);
router.post("/return", InventoryController.registerReturn);
router.get("/:productId/:warehouseId", InventoryController.getAvailability);

export default router;