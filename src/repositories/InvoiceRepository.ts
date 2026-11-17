import { Invoice } from "../models/Invoice";
import { db } from "../db/transaction";
import { Prisma } from "../generated/prisma/client";
import { isUuid } from "../db/ids";
import { Page, PageRequest, skipTake, toPage } from "../utils/pagination";

// PostgreSQL: tabla invoices. order_id es UNIQUE: una factura por pedido,
// garantizado por la base de datos aunque lleguen dos solicitudes a la vez.

type InvoiceRow = Prisma.InvoiceGetPayload<object>;

function toInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    orderId: row.orderId,
    buyerId: row.buyerId,
    amount: row.amount.toNumber(),
    issuedAt: row.issuedAt,
  };
}

export const InvoiceRepository = {
  async findPage(filter: { buyerId?: string | undefined }, request: PageRequest): Promise<Page<Invoice>> {
    const where: Prisma.InvoiceWhereInput = filter.buyerId ? { buyerId: filter.buyerId } : {};
    const [rows, total] = await Promise.all([
      db().invoice.findMany({ where, orderBy: { issuedAt: "desc" }, ...skipTake(request) }),
      db().invoice.count({ where }),
    ]);
    return toPage(rows.map(toInvoice), total, request);
  },

  async findById(id: string): Promise<Invoice | undefined> {
    if (!isUuid(id)) return undefined;
    const row = await db().invoice.findUnique({ where: { id } });
    return row ? toInvoice(row) : undefined;
  },

  async findByOrderId(orderId: string): Promise<Invoice | undefined> {
    if (!isUuid(orderId)) return undefined;
    const row = await db().invoice.findUnique({ where: { orderId } });
    return row ? toInvoice(row) : undefined;
  },

  async findAll(): Promise<Invoice[]> {
    const rows = await db().invoice.findMany({ orderBy: { issuedAt: "asc" } });
    return rows.map(toInvoice);
  },

  async create(invoice: Invoice): Promise<Invoice> {
    const row = await db().invoice.create({ data: invoice });
    return toInvoice(row);
  },
};
