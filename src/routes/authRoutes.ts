import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { authenticate } from "../middlewares/authenticate";
import { loginLimiterPerAccount, loginLimiterPerIp, registerLimiter } from "../middlewares/rateLimits";

const router = Router();

// Rutas públicas con límite de peticiones (RN-66, RN-67): frenan la adivinación de claves y la creación masiva de cuentas
router.post("/register", registerLimiter, AuthController.register);
router.post("/login", loginLimiterPerIp, loginLimiterPerAccount, AuthController.login);
router.get("/me", authenticate, AuthController.me);

export default router;
