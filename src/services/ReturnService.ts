import { randomUUID } from "crypto";
import { ReturnRequest, ReturnStatus } from "../models/ReturnRequest";
import { OrderStatus } from "../models/Order";
import { ReturnRepository } from "../repositories/ReturnRepository";
import { OrderService } from "./OrderService";
import { InventoryService } from "./InventoryService";
import { RefundService } from "./RefundService";
import { NotFoundError, ValidationError } from "../errors/AppError";

type RegisterReturnInput = {
  orderId: string;
  buyerId: string;
  productId: string;
  quantity: number;
  reason: string;
};

export const ReturnService = {
  async registerReturn(input: RegisterReturnInput): Promise<ReturnRequest> {
    if (input.quantity <= 0) {
      throw new ValidationError("La cantidad a devolver debe ser mayor a cero.");
    }
    if (typeof input.reason !== "string" || input.reason.trim() === "") {
      throw new ValidationError("El motivo de la devolución es obligatorio.");
    }

    const order = await OrderService.getOrderById(input.orderId);

    if (order.buyerId !== input.buyerId) {
      throw new ValidationError("Este pedido no pertenece al comprador indicado.");
    }
    if (order.status !== OrderStatus.DELIVERED) {
      throw new ValidationError("Solo se pueden devolver productos de pedidos entregados.");
    }

    const orderItem = order.items.find((item) => item.productId === input.productId);
    if (!orderItem) {
      throw new ValidationError("El producto no hace parte de este pedido.");
    }

    // Unidades ya devueltas (solicitadas o aprobadas) de este producto en este pedido
    const previousReturns = await ReturnRepository.findByOrderAndProduct(
      input.orderId,
      input.productId
    );
    const alreadyReturned = previousReturns
      .filter((request) => request.status !== ReturnStatus.REJECTED)
      .reduce((sum, request) => sum + request.quantity, 0);

    const returnable = orderItem.quantity - alreadyReturned;
    if (input.quantity > returnable) {
      throw new ValidationError(
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

  async getReturnById(id: string): Promise<ReturnRequest> {
    const request = await ReturnRepository.findById(id);
    if (!request) {
      throw new NotFoundError("Devolución no encontrada.");
    }
    return request;
  },

  async getReturnsByOrder(orderId: string): Promise<ReturnRequest[]> {
    return ReturnRepository.findByOrderId(orderId);
  },

  async listReturns(): Promise<ReturnRequest[]> {
    return ReturnRepository.findAll();
  },

  async processReturn(returnId: string, approve: boolean): Promise<ReturnRequest> {
    const request = await this.getReturnById(returnId);
    if (request.status !== ReturnStatus.REQUESTED) {
      throw new ValidationError("Esta devolución ya fue procesada.");
    }

    if (!approve) {
      return (await ReturnRepository.update(returnId, { status: ReturnStatus.REJECTED }))!;
    }

    const order = await OrderService.getOrderById(request.orderId);
    const orderItem = order.items.find((item) => item.productId === request.productId);
    if (!orderItem) {
      throw new ValidationError("El producto de la devolución no existe en el pedido.");
    }

    // PENDIENTE (paso de base de datos): estos tres pasos deben ir en una sola transacción.

    // 1. La mercancía vuelve al inventario de la bodega de la que salió
    await InventoryService.registerReturn(orderItem.productId, orderItem.warehouseId, request.quantity);

    // 2. Se genera el reembolso, usando el precio que se pagó (no el actual del producto)
    await RefundService.generateRefund(request.id, orderItem.unitPrice * request.quantity);

    // 3. Se marca la devolución como aprobada
    return (await ReturnRepository.update(returnId, { status: ReturnStatus.APPROVED }))!;
  },
};
