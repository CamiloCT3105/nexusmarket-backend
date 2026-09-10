// Enums: representan catálogos cerrados de valores (roles y estados posibles de un usuario).

export enum UserRole {
  BUYER = "BUYER",
  SELLER = "SELLER",
  LOGISTICS_OPERATOR = "LOGISTICS_OPERATOR",
  ADMIN = "ADMIN",
  SUPERVISOR = "SUPERVISOR",
}

export enum UserStatus {
  ACTIVE = "ACTIVE",
  BLOCKED = "BLOCKED",
}

//Objeto para User
export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}