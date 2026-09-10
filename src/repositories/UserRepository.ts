import { User } from "../models/User";

// Simulamos una "tabla" de usuarios con un array en memoria.
// Esto se pierde al reiniciar el servidor - es temporal, solo para desarrollo.
const users: User[] = [];

export const UserRepository = {
  findAll(): User[] {
    return users;
  },

  findById(id: string): User | undefined {
    return users.find((user) => user.id === id);
  },

  findByEmail(email: string): User | undefined {
    return users.find((user) => user.email === email);
  },

  create(user: User): User {
    users.push(user);
    return user;
  },

  update(id: string, updatedFields: Partial<User>): User | undefined {
    const user = this.findById(id);
    if (!user) return undefined;

    Object.assign(user, updatedFields);
    return user;
  },
};