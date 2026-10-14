import { Router } from "express";
import { CartController } from "../controllers/CartController";
import { ownerOrRoles } from "../middlewares/ownerOrRoles";

const router = Router();

// Sin roles extra: solo el dueño del carrito puede verlo o modificarlo
router.get("/:buyerId", ownerOrRoles("buyerId"), CartController.getCart);
router.post("/:buyerId/items", ownerOrRoles("buyerId"), CartController.addItem);
router.patch("/:buyerId/items/:productId", ownerOrRoles("buyerId"), CartController.updateQuantity);
router.delete("/:buyerId/items/:productId", ownerOrRoles("buyerId"), CartController.removeItem);

export default router;