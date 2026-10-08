import { Router } from "express";
import { WarehouseController } from "../controllers/WarehouseController";
import { authorize } from "../middlewares/authorize";
import { ownerOrRoles } from "../middlewares/ownerOrRoles";
import { UserRole } from "../models/User";

const router = Router();

router.post("/", authorize(UserRole.SELLER, UserRole.ADMIN), WarehouseController.create);
router.get(
  "/seller/:sellerId",
  ownerOrRoles("sellerId", UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.LOGISTICS_OPERATOR),
  WarehouseController.getBySeller
);
router.get(
  "/:id",
  authorize(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.LOGISTICS_OPERATOR, UserRole.SELLER),
  WarehouseController.getById
);
router.patch("/:id/link-seller", authorize(UserRole.ADMIN), WarehouseController.linkToSeller);

export default router;