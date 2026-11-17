import { User, UserRole, UserStatus } from "../models/User";
import { db } from "../db/transaction";
import { Prisma } from "../generated/prisma/client";
import { isRecordNotFound } from "../db/prismaErrors";
import { isUuid } from "../db/ids";
import { Page, PageRequest, skipTake, toPage } from "../utils/pagination";

// PostgreSQL (tabla users). Solo se leen las columnas que forman parte del modelo.
const userColumns = {
  id: true,
  fullName: true,
  email: true,
  documentNumber: true,
  role: true,
  status: true,
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof userColumns }>;

// Fila de la base de datos → modelo de dominio
function toUser(row: UserRow): User {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    documentNumber: row.documentNumber,
    role: row.role as UserRole,
    status: row.status as UserStatus,
  };
}

export type UserFilter = {
  role?: UserRole | undefined;
  status?: UserStatus | undefined;
  search?: string | undefined; // nombre, correo o documento
};

export const UserRepository = {
  async findAll(): Promise<User[]> {
    const rows = await db().user.findMany({ select: userColumns, orderBy: { createdAt: "asc" } });
    return rows.map(toUser);
  },

  async findPage(filter: UserFilter, request: PageRequest): Promise<Page<User>> {
    const where: Prisma.UserWhereInput = {
      ...(filter.role ? { role: filter.role } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.search
        ? {
            OR: [
              { fullName: { contains: filter.search, mode: "insensitive" } },
              { email: { contains: filter.search, mode: "insensitive" } },
              { documentNumber: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      db().user.findMany({ where, select: userColumns, orderBy: { createdAt: "desc" }, ...skipTake(request) }),
      db().user.count({ where }),
    ]);
    return toPage(rows.map(toUser), total, request);
  },

  async findById(id: string): Promise<User | undefined> {
    if (!isUuid(id)) return undefined;
    const row = await db().user.findUnique({ where: { id }, select: userColumns });
    return row ? toUser(row) : undefined;
  },

  // Sin distinguir mayúsculas: los correos registrados antes de normalizarlos también se encuentran
  async findByEmail(email: string): Promise<User | undefined> {
    const row = await db().user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: userColumns,
    });
    return row ? toUser(row) : undefined;
  },

  async findByDocumentNumber(documentNumber: string): Promise<User | undefined> {
    const row = await db().user.findUnique({ where: { documentNumber }, select: userColumns });
    return row ? toUser(row) : undefined;
  },

  async create(user: User): Promise<User> {
    const row = await db().user.create({ data: user, select: userColumns });
    return toUser(row);
  },

  async update(id: string, updatedFields: Partial<User>): Promise<User | undefined> {
    if (!isUuid(id)) return undefined;
    try {
      const row = await db().user.update({
        where: { id },
        data: updatedFields as Prisma.UserUpdateInput,
        select: userColumns,
      });
      return toUser(row);
    } catch (error) {
      if (isRecordNotFound(error)) return undefined;
      throw error;
    }
  },
};
