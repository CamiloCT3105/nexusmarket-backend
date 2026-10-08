import { Router } from "express";
import { BuyerController } from "../controllers/BuyerController";
import { authorize } from "../middlewares/authorize";
import { ownerOrRoles } from "../middlewares/ownerOrRoles";
import { UserRole } from "../models/User";

const router = Router();

router.post("/", authorize(UserRole.BUYER), BuyerController.register);
router.get("/:userId", ownerOrRoles("userId", UserRole.ADMIN, UserRole.SUPERVISOR), BuyerController.getByUserId);
router.patch("/:userId/addresses", ownerOrRoles("userId"), BuyerController.addAddress);
router.patch("/:userId/commercial-status", authorize(UserRole.ADMIN), BuyerController.updateCommercialStatus);

export default router;