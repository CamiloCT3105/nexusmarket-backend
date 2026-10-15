import { Router } from "express";
import { ReportController } from "../controllers/ReportController";
import { authorize } from "../middlewares/authorize";
import { UserRole } from "../models/User";

const router = Router();

// Un solo control para todo el módulo: los reportes son solo para Supervisor y Admin
router.use(authorize(UserRole.SUPERVISOR, UserRole.ADMIN));

router.get("/summary", ReportController.summary);
router.get("/sales", ReportController.sales);
router.get("/inventory", ReportController.inventory);
router.get("/logistics", ReportController.logistics);
router.get("/returns", ReportController.returns);

export default router;