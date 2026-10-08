import { Router } from "express";
import { InventoryController } from "../controllers/InventoryController";
import { authorize } from "../middlewares/authorize";
import { UserRole } from "../models/User";

const router = Router();

router.post("/inbound", authorize(UserRole.SELLER, UserRole.ADMIN), InventoryController.registerInbound);
router.post("/damaged", authorize(UserRole.SELLER, UserRole.ADMIN), InventoryController.markAsDamaged);
router.post("/reserve", authorize(UserRole.ADMIN), InventoryController.reserveStock);
router.post("/outbound", authorize(UserRole.ADMIN), InventoryController.confirmOutbound);
router.post("/return", authorize(UserRole.ADMIN), InventoryController.registerReturn);
router.get(
  "/:productId/:warehouseId",
  authorize(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.LOGISTICS_OPERATOR),
  InventoryController.getAvailability
);

export default router;