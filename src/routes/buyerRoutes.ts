import { Router } from "express";
import { BuyerController } from "../controllers/BuyerController";

const router = Router();

router.post("/", BuyerController.register);
router.get("/:userId", BuyerController.getByUserId);
router.patch("/:userId/addresses", BuyerController.addAddress);
router.patch("/:userId/commercial-status", BuyerController.updateCommercialStatus);

export default router;