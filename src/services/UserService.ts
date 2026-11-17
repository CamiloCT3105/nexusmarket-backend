import { randomUUID } from "crypto";
import { User, UserRole, UserStatus } from "../models/User";
import { UserRepository } from "../repositories/UserRepository";
import { ConflictError, NotFoundError } from "../errors/AppError";

//Datos para crear User. Id lo genera el sistema, status se maneja por default ACTIVE
type CreateUserInput = {
  fullName: string;
  email: string;
  role: UserRole;
};

export const UserService = {
  async createUser(input: CreateUserInput): Promise<User> {
    const existingUser = await UserRepository.findByEmail(input.email);
    if (existingUser) {
      throw new ConflictError("Ya existe un usuario registrado con este correo electrónico.");
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

  async getUserById(id: string): Promise<User> {
    const user = await UserRepository.findById(id);
    if (!user) {
      throw new NotFoundError("Usuario no encontrado.");
    }
    return user;
  },

  async listUsers(): Promise<User[]> {
    return UserRepository.findAll();
  },

  async findUserByEmail(email: string): Promise<User | undefined> {
    return UserRepository.findByEmail(email);
  },

  async changeStatus(id: string, newStatus: UserStatus): Promise<User> {
    await this.getUserById(id); // se valida existencia reutilizando validador.
    const updated = await UserRepository.update(id, { status: newStatus });
    return updated!; // sabemos que existe porque getUserById ya lo validó
  },

  async assignRole(id: string, newRole: UserRole): Promise<User> {
    await this.getUserById(id);
    const updated = await UserRepository.update(id, { role: newRole });
    return updated!;
  },
};
