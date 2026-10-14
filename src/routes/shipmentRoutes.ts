import { Router } from "express";
import { ShipmentController } from "../controllers/ShipmentController";
import { authorize } from "../middlewares/authorize";
import { UserRole } from "../models/User";

const router = Router();

router.post("/", authorize(UserRole.LOGISTICS_OPERATOR, UserRole.ADMIN), ShipmentController.create);
router.get(
  "/order/:orderId",
  authorize(UserRole.LOGISTICS_OPERATOR, UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.BUYER),
  ShipmentController.getByOrder
);
router.get(
  "/:id",
  authorize(UserRole.LOGISTICS_OPERATOR, UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.BUYER),
  ShipmentController.getById
);
router.patch(
  "/:id/status",
  authorize(UserRole.LOGISTICS_OPERATOR, UserRole.ADMIN),
  ShipmentController.updateStatus
);

export default router;