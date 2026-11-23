import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";
import { isUniqueViolation } from "../db/prismaErrors";

// Los errores de express.json() traen `type` y un `status` 4xx (paquete http-errors)
const BODY_ERRORS: Record<string, string> = {
  "entity.parse.failed": "El cuerpo de la petición no es un JSON válido.",
  "entity.too.large": "El cuerpo de la petición es demasiado grande.",
  "encoding.unsupported": "La codificación del cuerpo de la petición no es compatible.",
  "charset.unsupported": "El juego de caracteres del cuerpo de la petición no es compatible.",
  "request.aborted": "La petición se interrumpió antes de terminar.",
};

function bodyParserMessage(err: unknown): { status: number; message: string } | null {
  if (typeof err !== "object" || err === null) return null;
  const { type, status } = err as { type?: unknown; status?: unknown };
  if (typeof type !== "string" || typeof status !== "number" || status < 400 || status >= 500) return null;
  return { status, message: BODY_ERRORS[type] ?? "La petición no es válida." };
}

// Rutas que no existen
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ message: "Ruta no encontrada." });
}

// Middleware central de errores. Express 5 envía aquí automáticamente
// cualquier error lanzado (o promesa rechazada) dentro de un controller.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  // Carrera entre dos peticiones: la restricción UNIQUE de la base de datos frena el duplicado
  if (isUniqueViolation(err)) {
    res.status(409).json({ message: "El recurso ya existe." });
    return;
  }

  // Errores al leer el cuerpo (los lanza express.json()): son culpa de la petición, no del servidor
  const bodyError = bodyParserMessage(err);
  if (bodyError) {
    res.status(bodyError.status).json({ message: bodyError.message });
    return;
  }

  // Cualquier otra cosa es un fallo inesperado: se registra y NO se filtra el detalle al cliente
  console.error(err);
  res.status(500).json({ message: "Error interno del servidor." });
}
