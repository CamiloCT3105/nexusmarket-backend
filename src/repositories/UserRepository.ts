import { User } from "../models/User";
import { clone } from "./clone";

// Almacenamiento temporal en memoria (se pierde al reiniciar).
// La interfaz ya es asíncrona: cambiarla por una base de datos no afecta a los servicios.
const users: User[] = [];

export const UserRepository = {
  async findAll(): Promise<User[]> {
    return clone(users);
  },

  async findById(id: string): Promise<User | undefined> {
    const user = users.find((u) => u.id === id);
    return user && clone(user);
  },

  async findByEmail(email: string): Promise<User | undefined> {
    const user = users.find((u) => u.email === email);
    return user && clone(user);
  },

  async create(user: User): Promise<User> {
    users.push(clone(user));
    return clone(user);
  },

  async update(id: string, updatedFields: Partial<User>): Promise<User | undefined> {
    const user = users.find((u) => u.id === id);
    if (!user) return undefined;

    Object.assign(user, clone(updatedFields));
    return clone(user);
  },
};
