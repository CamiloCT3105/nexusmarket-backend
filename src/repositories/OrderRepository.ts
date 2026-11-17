import { Order, OrderItem, OrderStatus } from "../models/Order";
import { db } from "../db/transaction";
import { Prisma } from "../generated/prisma/client";
import { isUuid } from "../db/ids";
import { Page, PageRequest, skipTake, toPage } from "../utils/pagination";

// PostgreSQL: tablas orders + order_items.
// El dinero se guarda como DECIMAL(12,2) y se convierte a number en el modelo de dominio.

const orderWithItems = {
  include: { items: { orderBy: { productId: "asc" } } },
} satisfies Prisma.OrderDefaultArgs;

type OrderRow = Prisma.OrderGetPayload<typeof orderWithItems>;

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    buyerId: row.buyerId,
    items: row.items.map(
      (item): OrderItem => ({
        productId: item.productId,
        warehouseId: item.warehouseId,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toNumber(),
      })
    ),
    total: row.total.toNumber(),
    status: row.status as OrderStatus,
    createdAt: row.createdAt,
  };
}

export type OrderFilter = {
  status?: OrderStatus | undefined;
  buyerId?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  withAnyProduct?: string[] | undefined; // pedidos que contienen al menos uno de estos productos
};

export const OrderRepository = {
  async findPage(filter: OrderFilter, request: PageRequest): Promise<Page<Order>> {
    if (filter.buyerId !== undefined && !isUuid(filter.buyerId)) return toPage([], 0, request);
    const where: Prisma.OrderWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.buyerId ? { buyerId: filter.buyerId } : {}),
      ...(filter.from || filter.to
        ? { createdAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } }
        : {}),
      ...(filter.withAnyProduct ? { items: { some: { productId: { in: filter.withAnyProduct } } } } : {}),
    };
    const [rows, total] = await Promise.all([
      db().order.findMany({ where, orderBy: { createdAt: "desc" }, ...skipTake(request), ...orderWithItems }),
      db().order.count({ where }),
    ]);
    return toPage(rows.map(toOrder), total, request);
  },

  async findById(id: string): Promise<Order | undefined> {
    if (!isUuid(id)) return undefined;
    const row = await db().order.findUnique({ where: { id }, ...orderWithItems });
    return row ? toOrder(row) : undefined;
  },

  async findByBuyerId(buyerId: string): Promise<Order[]> {
    if (!isUuid(buyerId)) return [];
    const rows = await db().order.findMany({
      where: { buyerId },
      orderBy: { createdAt: "asc" },
      ...orderWithItems,
    });
    return rows.map(toOrder);
  },

  async findAll(): Promise<Order[]> {
    const rows = await db().order.findMany({ orderBy: { createdAt: "asc" }, ...orderWithItems });
    return rows.map(toOrder);
  },

  async create(order: Order): Promise<Order> {
    const row = await db().order.create({
      data: {
        id: order.id,
        buyerId: order.buyerId,
        total: order.total,
        status: order.status,
        createdAt: order.createdAt,
        items: {
          create: order.items.map((item) => ({
            productId: item.productId,
            warehouseId: item.warehouseId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
      ...orderWithItems,
    });
    return toOrder(row);
  },

  // Bloquea la fila del pedido hasta que termine la transacción activa (SELECT ... FOR UPDATE).
  // Serializa operaciones que leen y luego escriben sobre el mismo pedido (ej: devoluciones).
  // Solo tiene efecto dentro de transaction(); devuelve false si el pedido no existe.
  async lockForUpdate(id: string): Promise<boolean> {
    if (!isUuid(id)) return false;
    const rows = await db().$queryRaw<{ id: string }[]>`
      SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`;
    return rows.length === 1;
  },

  // Cambia el estado SOLO si el pedido sigue en `from` (control de concurrencia optimista).
  // Si dos peticiones intentan la misma transición a la vez, solo una gana.
  async updateStatusIf(id: string, from: OrderStatus, to: OrderStatus): Promise<boolean> {
    if (!isUuid(id)) return false;
    const result = await db().order.updateMany({
      where: { id, status: from },
      data: { status: to },
    });
    return result.count === 1;
  },
};
