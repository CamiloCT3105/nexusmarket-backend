import { randomUUID } from "crypto";
import { Order, OrderItem, OrderStatus } from "../models/Order";
import { ProductStatus } from "../models/Product";
import { OrderRepository } from "../repositories/OrderRepository";
import { CartService } from "./CartService";
import { ProductService } from "./ProductService";
import { WarehouseService } from "./WarehouseService";
import { InventoryService } from "./InventoryService";
import { ConflictError, NotFoundError, ValidationError } from "../errors/AppError";
import { transaction } from "../db/transaction";

// Define qué cambios de estado son válidos desde cada estado.
// DELIVERED tiene lista vacía: es un estado final.
const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID],
  [OrderStatus.PAID]: [OrderStatus.SHIPPED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
};

// Orden fijo para tocar filas de inventario. Si dos transacciones bloquearan las
// mismas filas en orden distinto (A→B y B→A), PostgreSQL abortaría una por deadlock.
function byInventoryRow(a: OrderItem, b: OrderItem): number {
  return (a.productId + a.warehouseId).localeCompare(b.productId + b.warehouseId);
}

// Redondeo a centavos para que la suma no arrastre errores de punto flotante
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export const OrderService = {
  // Convierte el carrito del comprador en un pedido
  async checkout(buyerId: string): Promise<Order> {
    const cart = await CartService.getOrCreateCart(buyerId);
    if (cart.items.length === 0) {
      throw new ValidationError("El carrito está vacío.");
    }

    // Fase 1: validar TODO antes de modificar nada (mensajes claros, sin tocar el stock)
    const plannedItems: OrderItem[] = [];
    for (const cartItem of cart.items) {
      const product = await ProductService.getProductById(cartItem.productId);

      if (product.status !== ProductStatus.PUBLISHED) {
        throw new ValidationError(
          `El producto "${product.name}" ya no está disponible para la venta.`
        );
      }

      const sellerWarehouses = await WarehouseService.getWarehousesBySeller(product.sellerId);
      const warehouseId = await InventoryService.findWarehouseWithStock(
        product.id,
        sellerWarehouses.map((warehouse) => warehouse.id),
        cartItem.quantity
      );

      if (!warehouseId) {
        throw new ValidationError(`Stock insuficiente para el producto "${product.name}".`);
      }

      plannedItems.push({
        productId: product.id,
        warehouseId,
        quantity: cartItem.quantity,
        unitPrice: product.price,
      });
    }

    const order: Order = {
      id: randomUUID(),
      buyerId,
      items: plannedItems,
      total: roundMoney(plannedItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)),
      status: OrderStatus.PENDING_PAYMENT,
      createdAt: new Date(),
    };

    // Fase 2: reservas + pedido en UNA transacción. Cada reserva es un UPDATE condicional
    // atómico; si otro pedido se llevó el stock entre la fase 1 y la 2, esa reserva falla
    // y se deshacen también las anteriores: nunca quedan reservas parciales.
    const created = await transaction(async () => {
      for (const item of [...plannedItems].sort(byInventoryRow)) {
        await InventoryService.reserveStock(item.productId, item.warehouseId, item.quantity);
      }
      return OrderRepository.create(order);
    });

    // El carrito (fuera de PostgreSQL) se vacía solo cuando el pedido ya está confirmado
    await CartService.clearCart(buyerId);
    return created;
  },

  async getOrderById(id: string): Promise<Order> {
    const order = await OrderRepository.findById(id);
    if (!order) {
      throw new NotFoundError("Pedido no encontrado.");
    }
    return order;
  },

  // Ver OrderRepository.lockForUpdate. Debe llamarse dentro de transaction().
  async lockOrder(id: string): Promise<void> {
    if (!(await OrderRepository.lockForUpdate(id))) {
      throw new NotFoundError("Pedido no encontrado.");
    }
  },

  async getOrdersByBuyer(buyerId: string): Promise<Order[]> {
    return OrderRepository.findByBuyerId(buyerId);
  },

  async listOrders(): Promise<Order[]> {
    return OrderRepository.findAll();
  },

  async changeStatus(orderId: string, newStatus: OrderStatus): Promise<Order> {
    if (!Object.values(OrderStatus).includes(newStatus)) {
      throw new ValidationError(
        `Estado de pedido inválido. Valores permitidos: ${Object.values(OrderStatus).join(", ")}.`
      );
    }

    const order = await this.getOrderById(orderId);

    if (order.status === OrderStatus.DELIVERED) {
      throw new ValidationError("Un pedido entregado es inmutable y no puede modificarse.");
    }

    if (!allowedTransitions[order.status].includes(newStatus)) {
      throw new ValidationError(
        `Transición inválida: no se puede pasar de ${order.status} a ${newStatus}.`
      );
    }

    await transaction(async () => {
      // Primero se "reclama" la transición: si otra petición ya cambió el estado,
      // esta no hace nada (evita, por ejemplo, despachar el inventario dos veces)
      if (!(await OrderRepository.updateStatusIf(orderId, order.status, newStatus))) {
        throw new ConflictError("El pedido cambió de estado mientras se procesaba. Intenta de nuevo.");
      }

      // Al despachar, la mercancía reservada sale físicamente del inventario
      if (newStatus === OrderStatus.SHIPPED) {
        for (const item of [...order.items].sort(byInventoryRow)) {
          await InventoryService.confirmOutbound(item.productId, item.warehouseId, item.quantity);
        }
      }
    });

    return this.getOrderById(orderId);
  },
};
