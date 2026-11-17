import { randomUUID } from "crypto";
import { User, UserRole, UserStatus } from "../models/User";
import { UserFilter, UserRepository } from "../repositories/UserRepository";
import { ConflictError, NotFoundError, ValidationError } from "../errors/AppError";
import { Page, PageRequest } from "../utils/pagination";

//Datos para crear User. Id lo genera el sistema, status se maneja por default ACTIVE
type CreateUserInput = {
  fullName: string;
  email: string;
  documentNumber: string;
  role: UserRole;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOCUMENT_PATTERN = /^[A-Z0-9-]{5,20}$/;

// Correo en minúsculas y sin espacios: "Ana@Mail.com " y "ana@mail.com" son el mismo usuario
export function normalizeEmail(email: unknown): string {
  if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim())) {
    throw new ValidationError("El correo electrónico no es válido.");
  }
  return email.trim().toLowerCase();
}

// Documento sin espacios ni puntos y en mayúsculas: "1.020.304" y "1020304" son el mismo
export function normalizeDocumentNumber(documentNumber: unknown): string {
  const normalized =
    typeof documentNumber === "string" ? documentNumber.replace(/[\s.]/g, "").toUpperCase() : "";
  if (!DOCUMENT_PATTERN.test(normalized)) {
    throw new ValidationError(
      "El documento de identidad debe tener entre 5 y 20 caracteres (letras, números o guiones)."
    );
  }
  return normalized;
}

export const UserService = {
  async createUser(input: CreateUserInput): Promise<User> {
    if (typeof input.fullName !== "string" || input.fullName.trim() === "") {
      throw new ValidationError("El nombre completo es obligatorio.");
    }
    if (!Object.values(UserRole).includes(input.role)) {
      throw new ValidationError("Rol inválido.");
    }
    const email = normalizeEmail(input.email);
    const documentNumber = normalizeDocumentNumber(input.documentNumber);

    if (await UserRepository.findByEmail(email)) {
      throw new ConflictError("Ya existe un usuario registrado con este correo electrónico.");
    }
    if (await UserRepository.findByDocumentNumber(documentNumber)) {
      throw new ConflictError("Ya existe un usuario registrado con este documento de identidad.");
    }

    const newUser: User = {
      id: randomUUID(),
      fullName: input.fullName.trim(),
      email,
      documentNumber,
      role: input.role,
      status: UserStatus.ACTIVE,
    };

    // Si dos registros simultáneos pasan los chequeos, la restricción UNIQUE frena el segundo (409)
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

  async listUsersPage(filter: UserFilter, request: PageRequest): Promise<Page<User>> {
    return UserRepository.findPage(filter, request);
  },

  async findUserByEmail(email: string): Promise<User | undefined> {
    if (typeof email !== "string") return undefined;
    return UserRepository.findByEmail(email.trim().toLowerCase());
  },

  async changeStatus(id: string, newStatus: UserStatus): Promise<User> {
    if (!Object.values(UserStatus).includes(newStatus)) {
      throw new ValidationError(`Estado inválido. Valores permitidos: ${Object.values(UserStatus).join(", ")}.`);
    }
    await this.getUserById(id); // se valida existencia reutilizando validador.
    const updated = await UserRepository.update(id, { status: newStatus });
    return updated!; // sabemos que existe porque getUserById ya lo validó
  },

  async assignRole(id: string, newRole: UserRole): Promise<User> {
    if (!Object.values(UserRole).includes(newRole)) {
      throw new ValidationError(`Rol inválido. Valores permitidos: ${Object.values(UserRole).join(", ")}.`);
    }
    await this.getUserById(id);
    const updated = await UserRepository.update(id, { role: newRole });
    return updated!;
  },

  // Reemplaza el documento temporal de un usuario creado antes de existir el campo
  async replacePendingDocument(id: string, documentNumber: string): Promise<User> {
    const normalized = normalizeDocumentNumber(documentNumber);
    const owner = await UserRepository.findByDocumentNumber(normalized);
    if (owner && owner.id !== id) {
      throw new ConflictError("Ya existe un usuario registrado con este documento de identidad.");
    }
    const updated = await UserRepository.update(id, { documentNumber: normalized });
    if (!updated) throw new NotFoundError("Usuario no encontrado.");
    return updated;
  },
};

export const PENDING_DOCUMENT_PREFIX = "PENDIENTE-";
