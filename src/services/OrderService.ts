import { randomUUID } from "crypto";
import { Order, OrderItem, OrderStatus } from "../models/Order";
import { ProductStatus } from "../models/Product";
import { OrderRepository } from "../repositories/OrderRepository";
import { CartService } from "./CartService";
import { ProductService } from "./ProductService";
import { WarehouseService } from "./WarehouseService";
import { InventoryService } from "./InventoryService";

// Define qué cambios de estado son válidos desde cada estado.
// DELIVERED tiene lista vacía: es un estado final.
const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID],
  [OrderStatus.PAID]: [OrderStatus.SHIPPED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
};

export const OrderService = {
  // Convierte el carrito del comprador en un pedido
  checkout(buyerId: string): Order {
    const cart = CartService.getOrCreateCart(buyerId);
    if (cart.items.length === 0) {
      throw new Error("El carrito está vacío.");
    }

    // Fase 1: validar TODO antes de modificar nada
    const plannedItems: OrderItem[] = cart.items.map((cartItem) => {
      const product = ProductService.getProductById(cartItem.productId);

      if (product.status !== ProductStatus.PUBLISHED) {
        throw new Error(`El producto "${product.name}" ya no está disponible para la venta.`);
      }

      const sellerWarehouses = WarehouseService.getWarehousesBySeller(product.sellerId);
      const warehouseId = InventoryService.findWarehouseWithStock(
        product.id,
        sellerWarehouses.map((warehouse) => warehouse.id),
        cartItem.quantity
      );

      if (!warehouseId) {
        throw new Error(`Stock insuficiente para el producto "${product.name}".`);
      }

      return {
        productId: product.id,
        warehouseId,
        quantity: cartItem.quantity,
        unitPrice: product.price,
      };
    });

    // Fase 2: ya sabemos que todo es válido, ahora sí reservamos el stock
    plannedItems.forEach((item) => {
      InventoryService.reserveStock(item.productId, item.warehouseId, item.quantity);
    });

    const total = plannedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    const order: Order = {
      id: randomUUID(),
      buyerId,
      items: plannedItems,
      total,
      status: OrderStatus.PENDING_PAYMENT,
      createdAt: new Date(),
    };

    OrderRepository.create(order);
    CartService.clearCart(buyerId);
    return order;
  },

  getOrderById(id: string): Order {
    const order = OrderRepository.findById(id);
    if (!order) {
      throw new Error("Pedido no encontrado.");
    }
    return order;
  },

  getOrdersByBuyer(buyerId: string): Order[] {
    return OrderRepository.findByBuyerId(buyerId);
  },

  changeStatus(orderId: string, newStatus: OrderStatus): Order {
    const order = this.getOrderById(orderId);

    if (order.status === OrderStatus.DELIVERED) {
      throw new Error("Un pedido entregado es inmutable y no puede modificarse.");
    }

    if (!allowedTransitions[order.status].includes(newStatus)) {
      throw new Error(`Transición inválida: no se puede pasar de ${order.status} a ${newStatus}.`);
    }

    // Al despachar, la mercancía reservada sale físicamente del inventario
    if (newStatus === OrderStatus.SHIPPED) {
      order.items.forEach((item) => {
        InventoryService.confirmOutbound(item.productId, item.warehouseId, item.quantity);
      });
    }

    return OrderRepository.update(orderId, { status: newStatus })!;
  },
};