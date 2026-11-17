import { Router } from "express";
import { OrderController } from "../controllers/OrderController";
import { authorize } from "../middlewares/authorize";
import { ownerOrRoles } from "../middlewares/ownerOrRoles";
import { UserRole } from "../models/User";

const router = Router();

router.post("/checkout", authorize(UserRole.BUYER), OrderController.checkout);
router.get(
  "/buyer/:buyerId",
  ownerOrRoles("buyerId", UserRole.ADMIN, UserRole.SUPERVISOR),
  OrderController.getByBuyer
);
// Todos los roles; el servicio limita qué ve cada uno (el vendedor, solo sus líneas)
router.get("/", OrderController.list);
router.get(
  "/:id",
  authorize(UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.LOGISTICS_OPERATOR),
  OrderController.getById
);
router.post("/:id/pay", authorize(UserRole.BUYER), OrderController.pay);
router.patch("/:id/status", authorize(UserRole.ADMIN), OrderController.changeStatus);

export default router;