import { OrderStatus } from "../models/Order";
import { Product, ProductStatus } from "../models/Product";
import { RefundStatus } from "../models/Refund";
import { ReturnStatus } from "../models/ReturnRequest";
import { ShipmentStatus } from "../models/Shipment";
import { UserRole } from "../models/User";
import {
  InventoryReport,
  LogisticsReport,
  ProductSales,
  RefundTotals,
  ReturnsReport,
  SalesReport,
  SummaryReport,
} from "../models/Report";
import { UserService } from "./UserService";
import { ProductService } from "./ProductService";
import { OrderService } from "./OrderService";
import { InvoiceService } from "./InvoiceService";
import { ShipmentService } from "./ShipmentService";
import { ReturnService } from "./ReturnService";
import { RefundService } from "./RefundService";
import { InventoryService } from "./InventoryService";

// Cuenta cuántos elementos hay por cada valor de un enum, incluyendo los que tienen 0
// (así el reporte siempre trae todas las claves, aunque no haya datos).
function countByEnum<E extends string>(allValues: E[], found: E[]): Record<E, number> {
  const result = {} as Record<E, number>;
  allValues.forEach((value) => {
    result[value] = 0;
  });
  found.forEach((value) => {
    result[value] += 1;
  });
  return result;
}

function buildProductMap(products: Product[]): Map<string, Product> {
  return new Map(products.map((product): [string, Product] => [product.id, product]));
}

export const ReportService = {
  async getSummary(): Promise<SummaryReport> {
    // Las consultas son independientes: se lanzan en paralelo
    const [users, products, orders, invoices, returns] = await Promise.all([
      UserService.listUsers(),
      ProductService.listProducts(),
      OrderService.listOrders(),
      InvoiceService.listInvoices(),
      ReturnService.listReturns(),
    ]);

    return {
      usersByRole: countByEnum(
        Object.values(UserRole),
        users.map((user) => user.role)
      ),
      productsByStatus: countByEnum(
        Object.values(ProductStatus),
        products.map((product) => product.status)
      ),
      ordersByStatus: countByEnum(
        Object.values(OrderStatus),
        orders.map((order) => order.status)
      ),
      totalInvoicedAmount: invoices.reduce((sum, invoice) => sum + invoice.amount, 0),
      pendingReturns: returns.filter((request) => request.status === ReturnStatus.REQUESTED)
        .length,
    };
  },

  // Una "venta" es un pedido que ya fue pagado (cualquier estado distinto de PENDING_PAYMENT).
  // Son ingresos brutos: los reembolsos se consultan en el reporte de devoluciones.
  async getSalesReport(from?: Date, to?: Date): Promise<SalesReport> {
    const [orders, products] = await Promise.all([
      OrderService.listOrders(),
      ProductService.listProducts(),
    ]);

    const sales = orders.filter((order) => {
      if (order.status === OrderStatus.PENDING_PAYMENT) return false;
      if (from && order.createdAt < from) return false;
      if (to && order.createdAt > to) return false;
      return true;
    });

    const productsById = buildProductMap(products);
    const byProduct = new Map<string, ProductSales>();
    const bySeller = new Map<string, number>();

    for (const order of sales) {
      for (const item of order.items) {
        const product = productsById.get(item.productId);
        const revenue = item.unitPrice * item.quantity;

        const current: ProductSales = byProduct.get(item.productId) ?? {
          productId: item.productId,
          productName: product?.name ?? "Producto desconocido",
          unitsSold: 0,
          revenue: 0,
        };
        current.unitsSold += item.quantity;
        current.revenue += revenue;
        byProduct.set(item.productId, current);

        if (product) {
          bySeller.set(product.sellerId, (bySeller.get(product.sellerId) ?? 0) + revenue);
        }
      }
    }

    const totalRevenue = sales.reduce((sum, order) => sum + order.total, 0);

    return {
      period: {
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
      },
      orderCount: sales.length,
      totalRevenue,
      averageTicket: sales.length > 0 ? Math.round(totalRevenue / sales.length) : 0,
      topProducts: [...byProduct.values()].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5),
      revenueBySeller: [...bySeller.entries()]
        .map(([sellerId, revenue]) => ({ sellerId, revenue }))
        .sort((a, b) => b.revenue - a.revenue),
    };
  },

  async getInventoryReport(threshold: number): Promise<InventoryReport> {
    const [products, inventoryItems] = await Promise.all([
      ProductService.listProducts(),
      InventoryService.listItems(),
    ]);
    const productsById = buildProductMap(products);

    const items = inventoryItems.map((item) => {
      const availableQuantity = InventoryService.getAvailableQuantity(item);
      return {
        productId: item.productId,
        productName: productsById.get(item.productId)?.name ?? "Producto desconocido",
        warehouseId: item.warehouseId,
        quantity: item.quantity,
        reservedQuantity: item.reservedQuantity,
        damagedQuantity: item.damagedQuantity,
        availableQuantity,
        lowStock: availableQuantity <= threshold,
      };
    });

    return {
      threshold,
      totalUnits: items.reduce((sum, row) => sum + row.quantity, 0),
      totalAvailable: items.reduce((sum, row) => sum + row.availableQuantity, 0),
      totalDamaged: items.reduce((sum, row) => sum + row.damagedQuantity, 0),
      lowStockCount: items.filter((row) => row.lowStock).length,
      items,
    };
  },

  async getLogisticsReport(): Promise<LogisticsReport> {
    const [shipments, orders] = await Promise.all([
      ShipmentService.listShipments(),
      OrderService.listOrders(),
    ]);
    const orderIdsWithShipment = new Set(shipments.map((shipment) => shipment.orderId));

    // Pedidos ya pagados a los que todavía nadie les creó el envío
    const ordersAwaitingShipment = orders
      .filter((order) => order.status === OrderStatus.PAID && !orderIdsWithShipment.has(order.id))
      .map((order) => ({ orderId: order.id, total: order.total, createdAt: order.createdAt }));

    return {
      shipmentsByStatus: countByEnum(
        Object.values(ShipmentStatus),
        shipments.map((shipment) => shipment.status)
      ),
      ordersAwaitingShipment,
    };
  },

  async getReturnsReport(): Promise<ReturnsReport> {
    const [returns, refunds] = await Promise.all([
      ReturnService.listReturns(),
      RefundService.listRefunds(),
    ]);

    const totalsFor = (status: RefundStatus): RefundTotals => {
      const matching = refunds.filter((refund) => refund.status === status);
      return {
        count: matching.length,
        amount: matching.reduce((sum, refund) => sum + refund.amount, 0),
      };
    };

    return {
      returnsByStatus: countByEnum(
        Object.values(ReturnStatus),
        returns.map((request) => request.status)
      ),
      refundsPending: totalsFor(RefundStatus.PENDING),
      refundsCompleted: totalsFor(RefundStatus.COMPLETED),
    };
  },
};