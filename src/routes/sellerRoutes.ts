import { Router } from "express";
import { SellerController } from "../controllers/SellerController";
import { authorize } from "../middlewares/authorize";
import { ownerOrRoles } from "../middlewares/ownerOrRoles";
import { UserRole } from "../models/User";

const router = Router();

router.post("/", authorize(UserRole.ADMIN), SellerController.onboard);
router.get("/:userId", ownerOrRoles("userId", UserRole.ADMIN, UserRole.SUPERVISOR), SellerController.getByUserId);
router.patch("/:userId/warehouses", authorize(UserRole.ADMIN), SellerController.assignWarehouse);

export default router;