import { Router } from "express";
import { OrderController } from "../controllers/OrderController";

const router = Router();

router.post("/checkout", OrderController.checkout);
router.get("/buyer/:buyerId", OrderController.getByBuyer);
router.get("/:id", OrderController.getById);
router.patch("/:id/status", OrderController.changeStatus);

export default router;