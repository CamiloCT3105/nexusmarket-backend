import { randomUUID } from "crypto";
import { User, UserRole, UserStatus } from "../models/User";
import { UserRepository } from "../repositories/UserRepository";

//Datos para crear User. Id lo genera el sistema, status se maneja por default ACTIVE
type CreateUserInput = {
  fullName: string;
  email: string;
  role: UserRole;
};

export const UserService = {
  createUser(input: CreateUserInput): User {
    const existingUser = UserRepository.findByEmail(input.email);
    if (existingUser) {
      throw new Error("Ya existe un usuario registrado con este correo electrónico.");
    }

    const newUser: User = {
      id: randomUUID(),
      fullName: input.fullName,
      email: input.email,
      role: input.role,
      status: UserStatus.ACTIVE,
    };

    return UserRepository.create(newUser);
  },

  getUserById(id: string): User {
    const user = UserRepository.findById(id);
    if (!user) {
      throw new Error("Usuario no encontrado.");
    }
    return user;
  },

  changeStatus(id: string, newStatus: UserStatus): User {
    const user = this.getUserById(id); // se valida existencia reutilizando validador.
    const updated = UserRepository.update(id, { status: newStatus });
    return updated!; // sabemos que existe porque getUserById ya lo validó
  },

  assignRole(id: string, newRole: UserRole): User {
    this.getUserById(id);
    const updated = UserRepository.update(id, { role: newRole });
    return updated!;
  },
};