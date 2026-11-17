import { Prisma } from "../generated/prisma/client";

// Códigos de error de Prisma que la aplicación interpreta
// https://www.prisma.io/docs/orm/reference/error-reference

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

// Violación de restricción UNIQUE (ej: dos registros simultáneos con el mismo correo)
export function isUniqueViolation(error: unknown): boolean {
  return hasCode(error, "P2002");
}

// update/delete sobre un registro que no existe
export function isRecordNotFound(error: unknown): boolean {
  return hasCode(error, "P2025");
}
