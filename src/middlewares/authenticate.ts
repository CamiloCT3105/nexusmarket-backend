import { NextFunction, Request, Response } from "express";
import { AuthUser } from "../models/AuthUser";
import { UserStatus } from "../models/User";
import { UserService } from "../services/UserService";
import { verifyToken } from "../utils/jwt";

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ message: "Token de autenticación requerido." });
    return;
  }

  let authUser: AuthUser;
  try {
    const payload = verifyToken(header.slice("Bearer ".length));
    const user = UserService.getUserById(payload.id);

    if (user.status !== UserStatus.ACTIVE) {
      res.status(403).json({ message: "Tu cuenta está bloqueada." });
      return;
    }

    // Tomamos el rol ACTUAL del usuario, no el que venía en el token:
    // si un administrador le cambia el rol, aplica de inmediato.
    authUser = { id: user.id, role: user.role };
  } catch {
    res.status(401).json({ message: "Token inválido o expirado." });
    return;
  }

  res.locals.authUser = authUser;
  next();
}

// Lee el usuario autenticado que dejó el middleware
export function getAuthUser(res: Response): AuthUser {
  const authUser = res.locals.authUser as AuthUser | undefined;
  if (!authUser) {
    throw new Error("Ruta sin autenticar: falta el middleware authenticate.");
  }
  return authUser;
}