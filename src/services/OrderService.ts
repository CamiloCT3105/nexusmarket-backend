import { randomUUID } from "crypto";
import { Order, OrderItem, OrderStatus } from "../models/Order";
import { ProductStatus } from "../models/Product";
import { OrderFilter, OrderRepository } from "../repositories/OrderRepository";
import { AuthUser } from "../models/AuthUser";
import { UserRole } from "../models/User";
import { Page, PageRequest, toPage } from "../utils/pagination";
import { CommercialStatus } from "../models/Buyer";
import { BuyerService } from "./BuyerService";
import { CartService } from "./CartService";
import { ProductService } from "./ProductService";
import { WarehouseService } from "./WarehouseService";
import { InventoryService } from "./InventoryService";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors/AppError";
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

// Lo que ve un vendedor de un pedido: solo sus líneas y el subtotal de ellas
export type OrderView = Order & { sellerSubtotal?: number };

async function sellerProductIds(sellerId: string): Promise<Set<string>> {
  const products = await ProductService.getProductsBySeller(sellerId);
  return new Set(products.map((product) => product.id));
}

// La dirección de entrega no se comparte con el vendedor: el despacho lo hace el operador logístico
function sellerView(order: Order, productIds: Set<string>): OrderView {
  const { shippingAddress: _private, ...rest } = order;
  const items = order.items.filter((item) => productIds.has(item.productId));
  return {
    ...rest,
    items,
    sellerSubtotal: roundMoney(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)),
  };
}

export const OrderService = {
  // Convierte el carrito del comprador en un pedido.
  // addressIndex elige la dirección de entrega: 0 = principal (por defecto), 1.. = adicionales en orden.
  async checkout(buyerId: string, addressIndex: unknown = 0): Promise<Order> {
    const buyer = await BuyerService.getBuyerByUserId(buyerId);
    // El estado comercial es la condición del comprador para realizar compras (especificación, perfil del comprador)
    if (buyer.commercialStatus === CommercialStatus.RESTRICTED) {
      throw new ForbiddenError(
        "Tu cuenta tiene una restricción comercial y no puede confirmar pedidos. Comunícate con el administrador."
      );
    }
    const addresses = [buyer.primaryAddress, ...buyer.additionalAddresses];
    if (typeof addressIndex !== "number" || !Number.isInteger(addressIndex) || addressIndex < 0 || addressIndex >= addresses.length) {
      throw new ValidationError(
        `La dirección de entrega no es válida: elige un número entre 0 (principal) y ${addresses.length - 1}.`
      );
    }
    const shippingAddress = addresses[addressIndex]!;

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
      shippingAddress: { ...shippingAddress },
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

  // Listado paginado según quién consulta:
  // - Comprador: solo sus pedidos.
  // - Vendedor: pedidos que incluyen sus productos, mostrando SOLO sus líneas y su subtotal
  //   (matriz de responsabilidades: el vendedor participa en la gestión de pedidos).
  // - Administrador, supervisor y operador logístico: todos.
  async listOrdersForViewer(viewer: AuthUser, filter: OrderFilter, request: PageRequest): Promise<Page<OrderView>> {
    switch (viewer.role) {
      case UserRole.BUYER:
        if (filter.buyerId && filter.buyerId !== viewer.id) {
          throw new ForbiddenError("Solo puedes consultar tus propios pedidos.");
        }
        return OrderRepository.findPage({ ...filter, buyerId: viewer.id }, request);
      case UserRole.SELLER: {
        const productIds = await sellerProductIds(viewer.id);
        if (productIds.size === 0) return toPage([], 0, request);
        const page = await OrderRepository.findPage({ ...filter, withAnyProduct: [...productIds] }, request);
        return { ...page, items: page.items.map((order) => sellerView(order, productIds)) };
      }
      default:
        return OrderRepository.findPage(filter, request);
    }
  },

  // Detalle de un pedido con las mismas reglas de visibilidad que el listado
  async getOrderForViewer(viewer: AuthUser, id: string): Promise<OrderView> {
    const order = await this.getOrderById(id);
    switch (viewer.role) {
      case UserRole.BUYER:
        if (order.buyerId !== viewer.id) throw new ForbiddenError("Solo puedes consultar tus propios pedidos.");
        return order;
      case UserRole.SELLER: {
        const productIds = await sellerProductIds(viewer.id);
        if (!order.items.some((item) => productIds.has(item.productId))) {
          throw new ForbiddenError("Este pedido no incluye productos tuyos.");
        }
        return sellerView(order, productIds);
      }
      default:
        return order;
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
