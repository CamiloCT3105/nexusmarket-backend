import { Seller } from "../models/Seller";
import { db } from "../db/transaction";
import { Prisma } from "../generated/prisma/client";
import { isUuid } from "../db/ids";

// PostgreSQL: tabla sellers. Las bodegas del vendedor NO se guardan como lista:
// se calculan desde warehouses.seller_id, así nunca pueden quedar desincronizadas.

const sellerWithWarehouses = {
  include: { warehouses: { select: { id: true }, orderBy: { id: "asc" } } },
} satisfies Prisma.SellerDefaultArgs;

type SellerRow = Prisma.SellerGetPayload<typeof sellerWithWarehouses>;

function toSeller(row: SellerRow): Seller {
  return { userId: row.userId, warehouseIds: row.warehouses.map((w) => w.id) };
}

export const SellerRepository = {
  async findAll(): Promise<Seller[]> {
    const rows = await db().seller.findMany(sellerWithWarehouses);
    return rows.map(toSeller);
  },

  async findByUserId(userId: string): Promise<Seller | undefined> {
    if (!isUuid(userId)) return undefined;
    const row = await db().seller.findUnique({ where: { userId }, ...sellerWithWarehouses });
    return row ? toSeller(row) : undefined;
  },

  // Las bodegas se vinculan desde WarehouseRepository (seller_id), no aquí
  async create(seller: Pick<Seller, "userId">): Promise<Seller> {
    const row = await db().seller.create({
      data: { userId: seller.userId },
      ...sellerWithWarehouses,
    });
    return toSeller(row);
  },
};
