import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";

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

  // Body con JSON mal formado (lo lanza express.json())
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ message: "El cuerpo de la petición no es un JSON válido." });
    return;
  }

  // Cualquier otra cosa es un fallo inesperado: se registra y NO se filtra el detalle al cliente
  console.error(err);
  res.status(500).json({ message: "Error interno del servidor." });
}
