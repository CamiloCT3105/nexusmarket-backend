import { UserRole } from "./User";

// Lo mínimo que necesitamos saber de quien hace una petición
export interface AuthUser {
  id: string;
  role: UserRole;
}