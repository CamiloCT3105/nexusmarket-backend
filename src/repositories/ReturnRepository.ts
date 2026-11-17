import { ReturnRequest, ReturnStatus } from "../models/ReturnRequest";
import { db } from "../db/transaction";
import { Prisma } from "../generated/prisma/client";
import { isUuid } from "../db/ids";

// PostgreSQL: tabla return_requests

type ReturnRow = Prisma.ReturnRequestGetPayload<object>;

function toReturn(row: ReturnRow): ReturnRequest {
  return {
    id: row.id,
    orderId: row.orderId,
    productId: row.productId,
    quantity: row.quantity,
    reason: row.reason,
    status: row.status as ReturnStatus,
    createdAt: row.createdAt,
  };
}

export const ReturnRepository = {
  async findById(id: string): Promise<ReturnRequest | undefined> {
    if (!isUuid(id)) return undefined;
    const row = await db().returnRequest.findUnique({ where: { id } });
    return row ? toReturn(row) : undefined;
  },

  async findByOrderId(orderId: string): Promise<ReturnRequest[]> {
    if (!isUuid(orderId)) return [];
    const rows = await db().returnRequest.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
    return rows.map(toReturn);
  },

  // Unidades de un producto ya comprometidas en devoluciones (solicitadas o aprobadas)
  async sumActiveQuantity(orderId: string, productId: string): Promise<number> {
    if (!isUuid(orderId)) return 0;
    const result = await db().returnRequest.aggregate({
      where: { orderId, productId, status: { not: ReturnStatus.REJECTED } },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  },

  async findAll(): Promise<ReturnRequest[]> {
    const rows = await db().returnRequest.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(toReturn);
  },

  async create(request: ReturnRequest): Promise<ReturnRequest> {
    const row = await db().returnRequest.create({ data: request });
    return toReturn(row);
  },

  // Procesa la devolución SOLO si sigue en `from`: dos aprobaciones simultáneas no generan dos reembolsos
  async updateStatusIf(id: string, from: ReturnStatus, to: ReturnStatus): Promise<boolean> {
    if (!isUuid(id)) return false;
    const result = await db().returnRequest.updateMany({ where: { id, status: from }, data: { status: to } });
    return result.count === 1;
  },
};
