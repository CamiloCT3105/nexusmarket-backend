import { Router } from "express";
import { RefundController } from "../controllers/RefundController";
import { authorize } from "../middlewares/authorize";
import { UserRole } from "../models/User";

const router = Router();

router.get(
  "/return/:returnId",
  authorize(UserRole.BUYER, UserRole.ADMIN, UserRole.SUPERVISOR),
  RefundController.getByReturn
);
router.get(
  "/:id",
  authorize(UserRole.BUYER, UserRole.ADMIN, UserRole.SUPERVISOR),
  RefundController.getById
);
router.patch("/:id/status", authorize(UserRole.ADMIN), RefundController.updateStatus);

export default router;