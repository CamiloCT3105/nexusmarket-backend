import { Router } from "express";
import { UserController } from "../controllers/UserController";

const router = Router();

router.post("/", UserController.create);
router.get("/:id", UserController.getById);
router.patch("/:id/status", UserController.changeStatus);
router.patch("/:id/role", UserController.assignRole);

export default router;