import { NextFunction, Request, Response } from "express";
import { UserRole } from "../models/User";
import { getAuthUser } from "./authenticate";
import { ForbiddenError } from "../errors/AppError";

// Permite el paso si el usuario autenticado es el "dueño" indicado en la URL
// (por ejemplo /users/:id donde :id es su propio id) o si tiene alguno de los roles dados.
// Uso: ownerOrRoles("userId", UserRole.ADMIN, UserRole.SUPERVISOR)
// Sin roles: solo puede pasar el propio dueño.
export function ownerOrRoles(paramName: string, ...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authUser = getAuthUser(res);

    if (authUser.id === req.params[paramName] || allowedRoles.includes(authUser.role)) {
      next();
      return;
    }

    throw new ForbiddenError("No tienes permisos para acceder a este recurso.");
  };
}
