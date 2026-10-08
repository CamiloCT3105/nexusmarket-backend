import { randomUUID } from "crypto";
import { ReturnRequest, ReturnStatus } from "../models/ReturnRequest";
import { OrderStatus } from "../models/Order";
import { UserRole } from "../models/User";
import { ReturnRepository } from "../repositories/ReturnRepository";
import { OrderService } from "./OrderService";
import { InventoryService } from "./InventoryService";
import { RefundService } from "./RefundService";

type RegisterReturnInput = {
  orderId: string;
  buyerId: string;
  productId: string;
  quantity: number;
  reason: string;
};

export const ReturnService = {
  registerReturn(input: RegisterReturnInput): ReturnRequest {
    if (input.quantity <= 0) {
      throw new Error("La cantidad a devolver debe ser mayor a cero.");
    }
    if (input.reason.trim() === "") {
      throw new Error("El motivo de la devolución es obligatorio.");
    }

    const order = OrderService.getOrderById(input.orderId);

    if (order.buyerId !== input.buyerId) {
      throw new Error("Este pedido no pertenece al comprador indicado.");
    }
    if (order.status !== OrderStatus.DELIVERED) {
      throw new Error("Solo se pueden devolver productos de pedidos entregados.");
    }

    const orderItem = order.items.find((item) => item.productId === input.productId);
    if (!orderItem) {
      throw new Error("El producto no hace parte de este pedido.");
    }

    // Unidades ya devueltas (solicitadas o aprobadas) de este producto en este pedido
    const alreadyReturned = ReturnRepository.findByOrderAndProduct(input.orderId, input.productId)
      .filter((request) => request.status !== ReturnStatus.REJECTED)
      .reduce((sum, request) => sum + request.quantity, 0);

    const returnable = orderItem.quantity - alreadyReturned;
    if (input.quantity > returnable) {
      throw new Error(
        `Cantidad inválida. Unidades que aún se pueden devolver de este producto: ${returnable}.`
      );
    }

    const request: ReturnRequest = {
      id: randomUUID(),
      orderId: input.orderId,
      productId: input.productId,
      quantity: input.quantity,
      reason: input.reason,
      status: ReturnStatus.REQUESTED,
      createdAt: new Date(),
    };

    return ReturnRepository.create(request);
  },

  getReturnById(id: string): ReturnRequest {
    const request = ReturnRepository.findById(id);
    if (!request) {
      throw new Error("Devolución no encontrada.");
    }
    return request;
  },

  getReturnsByOrder(orderId: string): ReturnRequest[] {
    return ReturnRepository.findByOrderId(orderId);
  },

  processReturn(returnId: string, approve: boolean, actingUserRole: UserRole): ReturnRequest {
    if (actingUserRole !== UserRole.ADMIN && actingUserRole !== UserRole.SELLER) {
      throw new Error("Solo un Administrador o un Vendedor puede procesar devoluciones.");
    }

    const request = this.getReturnById(returnId);
    if (request.status !== ReturnStatus.REQUESTED) {
      throw new Error("Esta devolución ya fue procesada.");
    }

    if (!approve) {
      return ReturnRepository.update(returnId, { status: ReturnStatus.REJECTED })!;
    }

    const order = OrderService.getOrderById(request.orderId);
    const orderItem = order.items.find((item) => item.productId === request.productId);
    if (!orderItem) {
      throw new Error("El producto de la devolución no existe en el pedido.");
    }

    // 1. La mercancía vuelve al inventario de la bodega de la que salió
    InventoryService.registerReturn(orderItem.productId, orderItem.warehouseId, request.quantity);

    // 2. Se genera el reembolso, usando el precio que se pagó (no el actual del producto)
    RefundService.generateRefund(request.id, orderItem.unitPrice * request.quantity);

    // 3. Se marca la devolución como aprobada
    return ReturnRepository.update(returnId, { status: ReturnStatus.APPROVED })!;
  },
};