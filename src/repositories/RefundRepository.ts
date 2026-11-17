import { Refund, RefundStatus } from "../models/Refund";
import { db } from "../db/transaction";
import { Prisma } from "../generated/prisma/client";
import { isUuid } from "../db/ids";

// PostgreSQL: tabla refunds. return_id es UNIQUE: un reembolso por devolución.

type RefundRow = Prisma.RefundGetPayload<object>;

function toRefund(row: RefundRow): Refund {
  return {
    id: row.id,
    returnId: row.returnId,
    amount: row.amount.toNumber(),
    status: row.status as RefundStatus,
    createdAt: row.createdAt,
  };
}

export const RefundRepository = {
  async findById(id: string): Promise<Refund | undefined> {
    if (!isUuid(id)) return undefined;
    const row = await db().refund.findUnique({ where: { id } });
    return row ? toRefund(row) : undefined;
  },

  async findByReturnId(returnId: string): Promise<Refund | undefined> {
    if (!isUuid(returnId)) return undefined;
    const row = await db().refund.findUnique({ where: { returnId } });
    return row ? toRefund(row) : undefined;
  },

  async findAll(): Promise<Refund[]> {
    const rows = await db().refund.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(toRefund);
  },

  async create(refund: Refund): Promise<Refund> {
    const row = await db().refund.create({ data: refund });
    return toRefund(row);
  },

  async updateStatusIf(id: string, from: RefundStatus, to: RefundStatus): Promise<boolean> {
    if (!isUuid(id)) return false;
    const result = await db().refund.updateMany({ where: { id, status: from }, data: { status: to } });
    return result.count === 1;
  },
};
