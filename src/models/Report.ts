import { OrderStatus } from "./Order";
import { ProductStatus } from "./Product";
import { RefundStatus } from "./Refund";
import { ReturnStatus } from "./ReturnRequest";
import { ShipmentStatus } from "./Shipment";
import { UserRole } from "./User";

export interface SummaryReport {
  usersByRole: Record<UserRole, number>;
  productsByStatus: Record<ProductStatus, number>;
  ordersByStatus: Record<OrderStatus, number>;
  totalInvoicedAmount: number;
  pendingReturns: number;
}

export interface ProductSales {
  productId: string;
  productName: string;
  unitsSold: number;
  revenue: number;
}

export interface SellerSales {
  sellerId: string;
  revenue: number;
}

export interface SalesReport {
  period: { from: string | null; to: string | null };
  orderCount: number;
  totalRevenue: number;
  averageTicket: number;
  topProducts: ProductSales[];
  revenueBySeller: SellerSales[];
}

export interface InventoryReportRow {
  productId: string;
  productName: string;
  warehouseId: string;
  quantity: number;
  reservedQuantity: number;
  damagedQuantity: number;
  availableQuantity: number;
  lowStock: boolean;
}

export interface InventoryReport {
  threshold: number;
  totalUnits: number;
  totalAvailable: number;
  totalDamaged: number;
  lowStockCount: number;
  items: InventoryReportRow[];
}

export interface AwaitingShipment {
  orderId: string;
  total: number;
  createdAt: Date;
}

export interface LogisticsReport {
  shipmentsByStatus: Record<ShipmentStatus, number>;
  ordersAwaitingShipment: AwaitingShipment[];
}

export interface RefundTotals {
  count: number;
  amount: number;
}

export interface ReturnsReport {
  returnsByStatus: Record<ReturnStatus, number>;
  refundsPending: RefundTotals;
  refundsCompleted: RefundTotals;
}