import { Request } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { env } from "../config/env";

// Límites de peticiones para las rutas públicas de autenticación (las únicas sin token).
// El conteo vive en memoria: alcanza para una sola instancia; con varias haría falta un almacén
// compartido (por ejemplo Redis).

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

// Las IPv6 se agrupan por subred /56: un mismo cliente suele tener muchas direcciones de un bloque
const clientIp = (req: Request): string => ipKeyGenerator(req.ip ?? "");

const loginEmail = (req: Request): string => {
  const email: unknown = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" ? email.trim().toLowerCase() : "";
};

const tooMany = (message: string) => ({ message });

const common = {
  standardHeaders: "draft-8",
  legacyHeaders: false,
} as const;

// Solo cuentan los intentos fallidos: quien entra bien nunca se bloquea, y una clase entera detrás
// de la misma IP puede iniciar sesión a la vez.
export const loginLimiterPerAccount = rateLimit({
  ...common,
  windowMs: FIFTEEN_MINUTES,
  limit: env.rateLimit.loginPerAccount,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${clientIp(req)}|${loginEmail(req)}`,
  message: tooMany("Demasiados intentos fallidos de inicio de sesión para esta cuenta. Intenta de nuevo en unos minutos."),
});

export const loginLimiterPerIp = rateLimit({
  ...common,
  windowMs: FIFTEEN_MINUTES,
  limit: env.rateLimit.loginPerIp,
  skipSuccessfulRequests: true,
  keyGenerator: clientIp,
  message: tooMany("Demasiados intentos fallidos de inicio de sesión desde tu red. Intenta de nuevo en unos minutos."),
});

export const registerLimiter = rateLimit({
  ...common,
  windowMs: ONE_HOUR,
  limit: env.rateLimit.registerPerIp,
  keyGenerator: clientIp,
  message: tooMany("Se crearon demasiadas cuentas desde tu red. Intenta de nuevo más tarde."),
});
