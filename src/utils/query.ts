import { Request } from "express";
import { ValidationError } from "../errors/AppError";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, PageRequest } from "./pagination";

// Lectura y validación de parámetros de consulta (?clave=valor).
// Un parámetro ausente o vacío se trata como "no filtrar"; uno mal formado responde 400.

function raw(req: Request, name: string): string | undefined {
  const value = req.query[name];
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string") {
    throw new ValidationError(`El parámetro '${name}' debe aparecer una sola vez.`);
  }
  return value;
}

export function optionalString(req: Request, name: string): string | undefined {
  const value = raw(req, name)?.trim();
  return value === "" ? undefined : value;
}

export function optionalEnum<E extends string>(req: Request, name: string, allowed: readonly E[]): E | undefined {
  const value = raw(req, name);
  if (value === undefined) return undefined;
  if (!allowed.includes(value as E)) {
    throw new ValidationError(`El parámetro '${name}' debe ser uno de: ${allowed.join(", ")}.`);
  }
  return value as E;
}

export function optionalNumber(req: Request, name: string, { min }: { min?: number } = {}): number | undefined {
  const value = raw(req, name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (min !== undefined && parsed < min)) {
    throw new ValidationError(
      `El parámetro '${name}' debe ser un número${min !== undefined ? ` mayor o igual a ${min}` : ""}.`
    );
  }
  return parsed;
}

function positiveInteger(req: Request, name: string, fallback: number): number {
  const value = raw(req, name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ValidationError(`El parámetro '${name}' debe ser un entero mayor o igual a 1.`);
  }
  return parsed;
}

// Fechas en UTC. Si `endOfDay` y llega solo el día (2026-10-08), incluye el día completo.
export function optionalDate(req: Request, name: string, endOfDay = false): Date | undefined {
  const value = raw(req, name);
  if (value === undefined) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`El parámetro '${name}' no es una fecha válida (usa el formato AAAA-MM-DD).`);
  }
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
}

// Rango de fechas from/to, validando que from no sea posterior a to
export function optionalDateRange(req: Request): { from?: Date; to?: Date } {
  const from = optionalDate(req, "from");
  const to = optionalDate(req, "to", true);
  if (from && to && from > to) {
    throw new ValidationError("La fecha 'from' no puede ser posterior a 'to'.");
  }
  return { ...(from ? { from } : {}), ...(to ? { to } : {}) };
}

export function pageRequest(req: Request): PageRequest {
  const page = positiveInteger(req, "page", 1);
  const pageSize = positiveInteger(req, "pageSize", DEFAULT_PAGE_SIZE);
  if (pageSize > MAX_PAGE_SIZE) {
    throw new ValidationError(`El parámetro 'pageSize' no puede ser mayor a ${MAX_PAGE_SIZE}.`);
  }
  return { page, pageSize };
}

// Escapa un texto para usarlo como búsqueda literal dentro de una expresión regular
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
