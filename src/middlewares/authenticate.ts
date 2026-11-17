import { NextFunction, Request, Response } from "express";
import { AuthUser } from "../models/AuthUser";
import { User, UserStatus } from "../models/User";
import { UserService } from "../services/UserService";
import { verifyToken } from "../utils/jwt";
import { ForbiddenError, UnauthorizedError } from "../errors/AppError";

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new UnauthorizedError("Token de autenticación requerido.");
  }

  let user: User;
  try {
    const payload = verifyToken(header.slice("Bearer ".length));
    user = await UserService.getUserById(payload.id);
  } catch {
    // Token mal firmado, vencido o de un usuario que ya no existe
    throw new UnauthorizedError("Token inválido o expirado.");
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new ForbiddenError("Tu cuenta está bloqueada.");
  }

  // Tomamos el rol ACTUAL del usuario, no el que venía en el token:
  // si un administrador le cambia el rol, aplica de inmediato.
  const authUser: AuthUser = { id: user.id, role: user.role };
  res.locals.authUser = authUser;
  next();
}

// Lee el usuario autenticado que dejó el middleware
export function getAuthUser(res: Response): AuthUser {
  const authUser = res.locals.authUser as AuthUser | undefined;
  if (!authUser) {
    // Error de programación (ruta sin authenticate): termina en 500, no es culpa del cliente
    throw new Error("Ruta sin autenticar: falta el middleware authenticate.");
  }
  return authUser;
}
