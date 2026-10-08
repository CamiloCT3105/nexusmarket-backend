import { Router } from "express";
import { CartController } from "../controllers/CartController";

const router = Router();

router.get("/:buyerId", CartController.getCart);
router.post("/:buyerId/items", CartController.addItem);
router.patch("/:buyerId/items/:productId", CartController.updateQuantity);
router.delete("/:buyerId/items/:productId", CartController.removeItem);

export default router;