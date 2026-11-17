import { Request } from "express";
import { ValidationError } from "../errors/AppError";

// Lee un parámetro de ruta obligatorio (ej: :id) o lanza 400
export function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string" || value === "") {
    throw new ValidationError(`El parámetro '${name}' es requerido.`);
  }
  return value;
}
