import { Router } from "express";
import { InvoiceController } from "../controllers/InvoiceController";
import { authorize } from "../middlewares/authorize";
import { UserRole } from "../models/User";

const router = Router();

router.post("/", authorize(UserRole.ADMIN), InvoiceController.generate);
router.get(
  "/order/:orderId",
  authorize(UserRole.BUYER, UserRole.ADMIN, UserRole.SUPERVISOR),
  InvoiceController.getByOrder
);
router.get(
  "/:id",
  authorize(UserRole.BUYER, UserRole.ADMIN, UserRole.SUPERVISOR),
  InvoiceController.getById
);

export default router;