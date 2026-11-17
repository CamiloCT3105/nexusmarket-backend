import { Warehouse, WarehouseType } from "../models/Warehouse";
import { db } from "../db/transaction";
import { Prisma } from "../generated/prisma/client";
import { isRecordNotFound } from "../db/prismaErrors";
import { isUuid } from "../db/ids";
import { Page, PageRequest, skipTake, toPage } from "../utils/pagination";

// PostgreSQL: tabla warehouses

type WarehouseRow = Prisma.WarehouseGetPayload<object>;

function toWarehouse(row: WarehouseRow): Warehouse {
  return {
    id: row.id,
    type: row.type as WarehouseType,
    location: row.location,
    // NULL en la base de datos = propiedad ausente en el modelo (exactOptionalPropertyTypes)
    ...(row.sellerId ? { sellerId: row.sellerId } : {}),
  };
}

export type WarehouseFilter = { type?: WarehouseType | undefined; sellerId?: string | undefined };

export const WarehouseRepository = {
  async findPage(filter: WarehouseFilter, request: PageRequest): Promise<Page<Warehouse>> {
    if (filter.sellerId !== undefined && !isUuid(filter.sellerId)) return toPage([], 0, request);
    const where: Prisma.WarehouseWhereInput = {
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.sellerId ? { sellerId: filter.sellerId } : {}),
    };
    const [rows, total] = await Promise.all([
      db().warehouse.findMany({ where, orderBy: [{ location: "asc" }, { id: "asc" }], ...skipTake(request) }),
      db().warehouse.count({ where }),
    ]);
    return toPage(rows.map(toWarehouse), total, request);
  },

  async findAll(): Promise<Warehouse[]> {
    const rows = await db().warehouse.findMany({ orderBy: { location: "asc" } });
    return rows.map(toWarehouse);
  },

  async findById(id: string): Promise<Warehouse | undefined> {
    if (!isUuid(id)) return undefined;
    const row = await db().warehouse.findUnique({ where: { id } });
    return row ? toWarehouse(row) : undefined;
  },

  async findBySellerId(sellerId: string): Promise<Warehouse[]> {
    if (!isUuid(sellerId)) return [];
    const rows = await db().warehouse.findMany({ where: { sellerId }, orderBy: { id: "asc" } });
    return rows.map(toWarehouse);
  },

  async create(warehouse: Warehouse): Promise<Warehouse> {
    const row = await db().warehouse.create({
      data: {
        id: warehouse.id,
        type: warehouse.type,
        location: warehouse.location,
        sellerId: warehouse.sellerId ?? null,
      },
    });
    return toWarehouse(row);
  },

  async update(id: string, updatedFields: Partial<Warehouse>): Promise<Warehouse | undefined> {
    if (!isUuid(id)) return undefined;
    try {
      const row = await db().warehouse.update({
        where: { id },
        data: updatedFields as Prisma.WarehouseUncheckedUpdateInput,
      });
      return toWarehouse(row);
    } catch (error) {
      if (isRecordNotFound(error)) return undefined;
      throw error;
    }
  },
};
