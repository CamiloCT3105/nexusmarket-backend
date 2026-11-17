import { OrderStatus } from "../models/Order";
import { Product, ProductStatus } from "../models/Product";
import { RefundStatus } from "../models/Refund";
import { ReturnStatus } from "../models/ReturnRequest";
import { ShipmentStatus } from "../models/Shipment";
import { UserRole } from "../models/User";
import {
  InventoryReport,
  LogisticsReport,
  ReturnsReport,
  SalesReport,
  SummaryReport,
} from "../models/Report";
import { ReportRepository, CountMap } from "../repositories/ReportRepository";
import { ProductService } from "./ProductService";
import { InventoryService } from "./InventoryService";

// Los totales de PostgreSQL se calculan con consultas agregadas (ReportRepository).
// Los productos (catálogo, fuera de PostgreSQL) se consultan por su servicio y se
// combinan aquí para poner nombres y vendedores.

// Completa con 0 los valores del enum que no aparecieron (el reporte siempre trae todas las claves)
function withAllKeys<E extends string>(allValues: E[], counts: CountMap): Record<E, number> {
  return Object.fromEntries(allValues.map((value) => [value, counts[value] ?? 0])) as Record<E, number>;
}

function countProductsByStatus(products: Product[]): Record<ProductStatus, number> {
  const counts: CountMap = {};
  products.forEach((product) => {
    counts[product.status] = (counts[product.status] ?? 0) + 1;
  });
  return withAllKeys(Object.values(ProductStatus), counts);
}

function buildProductMap(products: Product[]): Map<string, Product> {
  return new Map(products.map((product): [string, Product] => [product.id, product]));
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;
const UNKNOWN_PRODUCT = "Producto desconocido";

export const ReportService = {
  async getSummary(): Promise<SummaryReport> {
    // Las consultas son independientes: se lanzan en paralelo
    const [usersByRole, products, ordersByStatus, totalInvoicedAmount, returnsByStatus] =
      await Promise.all([
        ReportRepository.countUsersByRole(),
        ProductService.listProducts(),
        ReportRepository.countOrdersByStatus(),
        ReportRepository.totalInvoiced(),
        ReportRepository.countReturnsByStatus(),
      ]);

    return {
      usersByRole: withAllKeys(Object.values(UserRole), usersByRole),
      productsByStatus: countProductsByStatus(products),
      ordersByStatus: withAllKeys(Object.values(OrderStatus), ordersByStatus),
      totalInvoicedAmount,
      pendingReturns: returnsByStatus[ReturnStatus.REQUESTED] ?? 0,
    };
  },

  // Una "venta" es un pedido que ya fue pagado (cualquier estado distinto de PENDING_PAYMENT).
  // Son ingresos brutos: los reembolsos se consultan en el reporte de devoluciones.
  async getSalesReport(from?: Date, to?: Date): Promise<SalesReport> {
    const range = { from, to };
    const [totals, byProduct, products] = await Promise.all([
      ReportRepository.salesTotals(range),
      ReportRepository.salesByProduct(range),
      ProductService.listProducts(),
    ]);
    const productsById = buildProductMap(products);

    // Ingresos por vendedor: el vendedor está en el catálogo, así que se suma aquí
    const bySeller = new Map<string, number>();
    for (const row of byProduct) {
      const sellerId = productsById.get(row.productId)?.sellerId;
      if (sellerId) {
        bySeller.set(sellerId, (bySeller.get(sellerId) ?? 0) + row.revenue);
      }
    }

    return {
      period: {
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
      },
      orderCount: totals.orderCount,
      totalRevenue: totals.totalRevenue,
      averageTicket: totals.orderCount > 0 ? roundMoney(totals.totalRevenue / totals.orderCount) : 0,
      topProducts: byProduct.slice(0, 5).map((row) => ({
        productId: row.productId,
        productName: productsById.get(row.productId)?.name ?? UNKNOWN_PRODUCT,
        unitsSold: row.unitsSold,
        revenue: roundMoney(row.revenue),
      })),
      revenueBySeller: [...bySeller.entries()]
        .map(([sellerId, revenue]) => ({ sellerId, revenue: roundMoney(revenue) }))
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
        productName: productsById.get(item.productId)?.name ?? UNKNOWN_PRODUCT,
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
    const [shipmentsByStatus, ordersAwaitingShipment] = await Promise.all([
      ReportRepository.countShipmentsByStatus(),
      ReportRepository.ordersAwaitingShipment(),
    ]);

    return {
      shipmentsByStatus: withAllKeys(Object.values(ShipmentStatus), shipmentsByStatus),
      ordersAwaitingShipment,
    };
  },

  async getReturnsReport(): Promise<ReturnsReport> {
    const [returnsByStatus, refundTotals] = await Promise.all([
      ReportRepository.countReturnsByStatus(),
      ReportRepository.refundTotalsByStatus(),
    ]);

    return {
      returnsByStatus: withAllKeys(Object.values(ReturnStatus), returnsByStatus),
      refundsPending: refundTotals[RefundStatus.PENDING] ?? { count: 0, amount: 0 },
      refundsCompleted: refundTotals[RefundStatus.COMPLETED] ?? { count: 0, amount: 0 },
    };
  },
};
