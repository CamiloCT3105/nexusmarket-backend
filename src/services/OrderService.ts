import { randomUUID } from "crypto";
import { Order, OrderItem, OrderStatus } from "../models/Order";
import { ProductStatus } from "../models/Product";
import { OrderRepository } from "../repositories/OrderRepository";
import { CartService } from "./CartService";
import { ProductService } from "./ProductService";
import { WarehouseService } from "./WarehouseService";
import { InventoryService } from "./InventoryService";
import { NotFoundError, ValidationError } from "../errors/AppError";

// Define qué cambios de estado son válidos desde cada estado.
// DELIVERED tiene lista vacía: es un estado final.
const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID],
  [OrderStatus.PAID]: [OrderStatus.SHIPPED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
};

export const OrderService = {
  // Convierte el carrito del comprador en un pedido.
  // PENDIENTE (paso de base de datos): las fases 1 y 2 deben correr dentro de una
  // transacción SQL con bloqueo de filas de inventario. Mientras sea en memoria,
  // dos checkouts simultáneos podrían intercalarse entre la validación y la reserva.
  async checkout(buyerId: string): Promise<Order> {
    const cart = await CartService.getOrCreateCart(buyerId);
    if (cart.items.length === 0) {
      throw new ValidationError("El carrito está vacío.");
    }

    // Fase 1: validar TODO antes de modificar nada
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

    // Fase 2: ya sabemos que todo es válido, ahora sí reservamos el stock
    for (const item of plannedItems) {
      await InventoryService.reserveStock(item.productId, item.warehouseId, item.quantity);
    }

    const total = plannedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    const order: Order = {
      id: randomUUID(),
      buyerId,
      items: plannedItems,
      total,
      status: OrderStatus.PENDING_PAYMENT,
      createdAt: new Date(),
    };

    const created = await OrderRepository.create(order);
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

  async getOrdersByBuyer(buyerId: string): Promise<Order[]> {
    return OrderRepository.findByBuyerId(buyerId);
  },

  async listOrders(): Promise<Order[]> {
    return OrderRepository.findAll();
  },

  async changeStatus(orderId: string, newStatus: OrderStatus): Promise<Order> {
    const order = await this.getOrderById(orderId);

    if (order.status === OrderStatus.DELIVERED) {
      throw new ValidationError("Un pedido entregado es inmutable y no puede modificarse.");
    }

    if (!allowedTransitions[order.status].includes(newStatus)) {
      throw new ValidationError(
        `Transición inválida: no se puede pasar de ${order.status} a ${newStatus}.`
      );
    }

    // Al despachar, la mercancía reservada sale físicamente del inventario
    if (newStatus === OrderStatus.SHIPPED) {
      for (const item of order.items) {
        await InventoryService.confirmOutbound(item.productId, item.warehouseId, item.quantity);
      }
    }

    return (await OrderRepository.update(orderId, { status: newStatus }))!;
  },
};
