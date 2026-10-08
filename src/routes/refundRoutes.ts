import { Router } from "express";
import { RefundController } from "../controllers/RefundController";

const router = Router();

router.get("/return/:returnId", RefundController.getByReturn);
router.get("/:id", RefundController.getById);
router.patch("/:id/status", RefundController.updateStatus);

export default router;