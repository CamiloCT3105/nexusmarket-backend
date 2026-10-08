import { Router } from "express";
import { ReturnController } from "../controllers/ReturnController";
import { authorize } from "../middlewares/authorize";
import { UserRole } from "../models/User";

const router = Router();

router.post("/", authorize(UserRole.BUYER), ReturnController.register);
router.get(
  "/order/:orderId",
  authorize(UserRole.BUYER, UserRole.ADMIN, UserRole.SUPERVISOR),
  ReturnController.getByOrder
);
router.get(
  "/:id",
  authorize(UserRole.BUYER, UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.SELLER),
  ReturnController.getById
);
router.patch("/:id/process", authorize(UserRole.SELLER, UserRole.ADMIN), ReturnController.process);

export default router;