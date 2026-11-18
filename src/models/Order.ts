import { Address } from "./Buyer";

export enum OrderStatus {
  PENDING_PAYMENT = "PENDING_PAYMENT",
  PAID = "PAID",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
}

export interface OrderItem {
  productId: string;
  warehouseId: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  buyerId: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: Date;
  // Copia de la dirección elegida al confirmar; no existe en pedidos creados antes de guardarla
  shippingAddress?: Address;
}