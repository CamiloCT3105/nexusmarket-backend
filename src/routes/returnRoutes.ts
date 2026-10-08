import { Router } from "express";
import { ReturnController } from "../controllers/ReturnController";

const router = Router();

router.post("/", ReturnController.register);
router.get("/order/:orderId", ReturnController.getByOrder);
router.get("/:id", ReturnController.getById);
router.patch("/:id/process", ReturnController.process);

export default router;