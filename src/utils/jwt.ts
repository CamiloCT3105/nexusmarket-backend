import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AuthUser } from "../models/AuthUser";
import { UserRole } from "../models/User";

export function signToken(user: AuthUser): string {
  return jwt.sign({ role: user.role }, env.jwtSecret, {
    subject: user.id,
    expiresIn: env.jwtExpiresInSeconds,
  });
}

export function verifyToken(token: string): AuthUser {
  const decoded = jwt.verify(token, env.jwtSecret);

  if (
    typeof decoded === "string" ||
    typeof decoded.sub !== "string" ||
    !Object.values(UserRole).includes(decoded.role)
  ) {
    throw new Error("Token inválido.");
  }

  return { id: decoded.sub, role: decoded.role as UserRole };
}