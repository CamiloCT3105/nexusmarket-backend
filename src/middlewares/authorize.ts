import { NextFunction, Request, Response } from "express";
import { UserRole } from "../models/User";
import { getAuthUser } from "./authenticate";

// Uso: authorize(UserRole.ADMIN, UserRole.SUPERVISOR)
export function authorize(...allowedRoles: UserRole[]) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const authUser = getAuthUser(res);

    if (!allowedRoles.includes(authUser.role)) {
      res.status(403).json({ message: "No tienes permisos para realizar esta acción." });
      return;
    }
    next();
  };
}