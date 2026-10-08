import { Router } from "express";
import { InvoiceController } from "../controllers/InvoiceController";

const router = Router();

router.post("/", InvoiceController.generate);
router.get("/order/:orderId", InvoiceController.getByOrder);
router.get("/:id", InvoiceController.getById);

export default router;