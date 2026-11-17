import { Refund, RefundStatus } from "../models/Refund";
import { db } from "../db/transaction";
import { Prisma } from "../generated/prisma/client";
import { isUuid } from "../db/ids";
import { Page, PageRequest, skipTake, toPage } from "../utils/pagination";

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

export type RefundFilter = {
  status?: RefundStatus | undefined;
  buyerId?: string | undefined; // reembolso → devolución → pedido → comprador
};

export const RefundRepository = {
  async findPage(filter: RefundFilter, request: PageRequest): Promise<Page<Refund>> {
    const where: Prisma.RefundWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.buyerId ? { returnRequest: { order: { buyerId: filter.buyerId } } } : {}),
    };
    const [rows, total] = await Promise.all([
      db().refund.findMany({ where, orderBy: { createdAt: "desc" }, ...skipTake(request) }),
      db().refund.count({ where }),
    ]);
    return toPage(rows.map(toRefund), total, request);
  },

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
