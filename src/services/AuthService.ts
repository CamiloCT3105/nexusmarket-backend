import { User, UserRole, UserStatus } from "../models/User";
import { CredentialRepository } from "../repositories/CredentialRepository";
import { UserService } from "./UserService";
import { hashPassword, verifyPassword } from "../utils/password";
import { signToken } from "../utils/jwt";
import { env } from "../config/env";

type RegisterUserInput = {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
};

const MIN_PASSWORD_LENGTH = 8;

export const AuthService = {
  // Crea el usuario y su credencial. Lo usa el registro público (rol BUYER)
  // y, en el siguiente paso, el Administrador para crear otros roles.
  registerUser(input: RegisterUserInput): User {
    if (typeof input.password !== "string" || input.password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }

    const user = UserService.createUser({
      fullName: input.fullName,
      email: input.email,
      role: input.role,
    });

    CredentialRepository.create({
      userId: user.id,
      passwordHash: hashPassword(input.password),
    });

    return user;
  },

  // El registro público SIEMPRE crea compradores: nadie puede auto-asignarse otro rol
  registerBuyerAccount(input: Omit<RegisterUserInput, "role">): User {
    return this.registerUser({ ...input, role: UserRole.BUYER });
  },

  login(email: string, password: string): { token: string; user: User } {
    // Mismo mensaje para "correo inexistente" y "clave incorrecta":
    // así no se revela qué correos están registrados.
    const invalidCredentials = new Error("Credenciales inválidas.");

    if (typeof email !== "string" || typeof password !== "string") {
      throw invalidCredentials;
    }

    const user = UserService.findUserByEmail(email);
    if (!user) throw invalidCredentials;

    const credential = CredentialRepository.findByUserId(user.id);
    if (!credential || !verifyPassword(password, credential.passwordHash)) {
      throw invalidCredentials;
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new Error("Tu cuenta está bloqueada. Contacta a un administrador.");
    }

    return { token: signToken({ id: user.id, role: user.role }), user };
  },

  // Crea el primer Administrador a partir del .env (si no existe ya)
  seedAdmin(): void {
    if (!env.adminEmail || !env.adminPassword) {
      console.warn("ADMIN_EMAIL / ADMIN_PASSWORD no configurados: no se creó administrador.");
      return;
    }
    if (UserService.findUserByEmail(env.adminEmail)) return;

    this.registerUser({
      fullName: "Administrador",
      email: env.adminEmail,
      password: env.adminPassword,
      role: UserRole.ADMIN,
    });
  },
};