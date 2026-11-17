import { NextFunction, Request, Response } from "express";
import { UserRole } from "../models/User";
import { getAuthUser } from "./authenticate";
import { ForbiddenError } from "../errors/AppError";

// Uso: authorize(UserRole.ADMIN, UserRole.SUPERVISOR)
export function authorize(...allowedRoles: UserRole[]) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const authUser = getAuthUser(res);

    if (!allowedRoles.includes(authUser.role)) {
      throw new ForbiddenError("No tienes permisos para realizar esta acción.");
    }
    next();
  };
}
