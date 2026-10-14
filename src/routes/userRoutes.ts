import { Router } from "express";
import { UserController } from "../controllers/UserController";
import { authorize } from "../middlewares/authorize";
import { ownerOrRoles } from "../middlewares/ownerOrRoles";
import { UserRole } from "../models/User";

const router = Router();

router.post("/", authorize(UserRole.ADMIN), UserController.create);
router.get("/:id", ownerOrRoles("id", UserRole.ADMIN, UserRole.SUPERVISOR), UserController.getById);
router.patch("/:id/status", authorize(UserRole.ADMIN), UserController.changeStatus);
router.patch("/:id/role", authorize(UserRole.ADMIN), UserController.assignRole);

export default router;