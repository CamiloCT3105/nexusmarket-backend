import { db } from "../db/transaction";
import { Prisma } from "../generated/prisma/client";

// Consultas de SOLO LECTURA para los reportes (OBJ-12).
//
// Los reportes cruzan datos de varios módulos. En lugar de traer todas las filas a Node
// y contarlas ahí, se agregan en PostgreSQL (GROUP BY, SUM, COUNT): la base devuelve
// solo los totales. Este repositorio nunca escribe.

export type DateRange = { from?: Date | undefined; to?: Date | undefined };

// Conteo por valor de un enum: { valor: cantidad }
export type CountMap = Record<string, number>;

function toCountMap<K extends string>(rows: Array<{ _count: { _all: number } } & Record<K, string>>, key: K): CountMap {
  return Object.fromEntries(rows.map((row) => [row[key], row._count._all]));
}

// Ventas = pedidos ya pagados (cualquier estado distinto de PENDING_PAYMENT) dentro del rango
function salesWhere(range: DateRange): Prisma.OrderWhereInput {
  return {
    status: { not: "PENDING_PAYMENT" },
    createdAt: {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lte: range.to } : {}),
    },
  };
}

export const ReportRepository = {
  async countUsersByRole(): Promise<CountMap> {
    const rows = await db().user.groupBy({ by: ["role"], _count: { _all: true } });
    return toCountMap(rows, "role");
  },

  async countOrdersByStatus(): Promise<CountMap> {
    const rows = await db().order.groupBy({ by: ["status"], _count: { _all: true } });
    return toCountMap(rows, "status");
  },

  async countShipmentsByStatus(): Promise<CountMap> {
    const rows = await db().shipment.groupBy({ by: ["status"], _count: { _all: true } });
    return toCountMap(rows, "status");
  },

  async countReturnsByStatus(): Promise<CountMap> {
    const rows = await db().returnRequest.groupBy({ by: ["status"], _count: { _all: true } });
    return toCountMap(rows, "status");
  },

  async totalInvoiced(): Promise<number> {
    const result = await db().invoice.aggregate({ _sum: { amount: true } });
    return result._sum.amount?.toNumber() ?? 0;
  },

  async refundTotalsByStatus(): Promise<Record<string, { count: number; amount: number }>> {
    const rows = await db().refund.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { amount: true },
    });
    return Object.fromEntries(
      rows.map((row) => [row.status, { count: row._count._all, amount: row._sum.amount?.toNumber() ?? 0 }])
    );
  },

  async salesTotals(range: DateRange): Promise<{ orderCount: number; totalRevenue: number }> {
    const result = await db().order.aggregate({
      where: salesWhere(range),
      _count: { _all: true },
      _sum: { total: true },
    });
    return { orderCount: result._count._all, totalRevenue: result._sum.total?.toNumber() ?? 0 };
  },

  // Unidades e ingresos por producto. El ingreso (cantidad × precio pagado) se calcula
  // en SQL; Prisma no permite multiplicar columnas en groupBy, por eso es SQL directo.
  async salesByProduct(range: DateRange): Promise<Array<{ productId: string; unitsSold: number; revenue: number }>> {
    const conditions = [Prisma.sql`o.status <> 'PENDING_PAYMENT'`];
    if (range.from) conditions.push(Prisma.sql`o.created_at >= ${range.from}`);
    if (range.to) conditions.push(Prisma.sql`o.created_at <= ${range.to}`);

    const rows = await db().$queryRaw<Array<{ product_id: string; units: number; revenue: Prisma.Decimal }>>`
      SELECT oi.product_id,
             SUM(oi.quantity)::int            AS units,
             SUM(oi.quantity * oi.unit_price) AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
       WHERE ${Prisma.join(conditions, " AND ")}
       GROUP BY oi.product_id
       ORDER BY units DESC, revenue DESC`;

    return rows.map((row) => ({
      productId: row.product_id,
      unitsSold: row.units,
      revenue: Number(row.revenue),
    }));
  },

  // Pedidos pagados a los que todavía no se les ha creado envío (LEFT JOIN ... IS NULL)
  async ordersAwaitingShipment(): Promise<Array<{ orderId: string; total: number; createdAt: Date }>> {
    const rows = await db().order.findMany({
      where: { status: "PAID", shipment: null },
      select: { id: true, total: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({ orderId: row.id, total: row.total.toNumber(), createdAt: row.createdAt }));
  },
};
