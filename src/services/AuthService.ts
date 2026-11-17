import { User, UserRole, UserStatus } from "../models/User";
import { CredentialRepository } from "../repositories/CredentialRepository";
import { UserService } from "./UserService";
import { hashPassword, verifyPassword } from "../utils/password";
import { signToken } from "../utils/jwt";
import { env } from "../config/env";
import { ForbiddenError, UnauthorizedError, ValidationError } from "../errors/AppError";

type RegisterUserInput = {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
};

const MIN_PASSWORD_LENGTH = 8;

export const AuthService = {
  // Crea el usuario y su credencial. Lo usa el registro público (rol BUYER)
  // y el Administrador para crear otros roles.
  async registerUser(input: RegisterUserInput): Promise<User> {
    if (typeof input.password !== "string" || input.password.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(
        `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
      );
    }

    const user = await UserService.createUser({
      fullName: input.fullName,
      email: input.email,
      role: input.role,
    });

    await CredentialRepository.create({
      userId: user.id,
      passwordHash: hashPassword(input.password),
    });

    return user;
  },

  // El registro público SIEMPRE crea compradores: nadie puede auto-asignarse otro rol
  async registerBuyerAccount(input: Omit<RegisterUserInput, "role">): Promise<User> {
    return this.registerUser({ ...input, role: UserRole.BUYER });
  },

  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    // Mismo mensaje para "correo inexistente" y "clave incorrecta":
    // así no se revela qué correos están registrados.
    const invalidCredentials = new UnauthorizedError("Credenciales inválidas.");

    if (typeof email !== "string" || typeof password !== "string") {
      throw invalidCredentials;
    }

    const user = await UserService.findUserByEmail(email);
    if (!user) throw invalidCredentials;

    const credential = await CredentialRepository.findByUserId(user.id);
    if (!credential || !verifyPassword(password, credential.passwordHash)) {
      throw invalidCredentials;
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError("Tu cuenta está bloqueada. Contacta a un administrador.");
    }

    return { token: signToken({ id: user.id, role: user.role }), user };
  },

  // Crea el primer Administrador a partir del .env (si no existe ya)
  async seedAdmin(): Promise<void> {
    if (!env.adminEmail || !env.adminPassword) {
      console.warn("ADMIN_EMAIL / ADMIN_PASSWORD no configurados: no se creó administrador.");
      return;
    }
    if (await UserService.findUserByEmail(env.adminEmail)) return;

    await this.registerUser({
      fullName: "Administrador",
      email: env.adminEmail,
      password: env.adminPassword,
      role: UserRole.ADMIN,
    });
  },
};
