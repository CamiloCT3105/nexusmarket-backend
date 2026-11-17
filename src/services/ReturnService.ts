import { randomUUID } from "crypto";
import { ReturnRequest, ReturnStatus } from "../models/ReturnRequest";
import { OrderStatus } from "../models/Order";
import { ReturnRepository } from "../repositories/ReturnRepository";
import { OrderService } from "./OrderService";
import { InventoryService } from "./InventoryService";
import { RefundService } from "./RefundService";
import { ConflictError, NotFoundError, ValidationError } from "../errors/AppError";
import { transaction } from "../db/transaction";

type RegisterReturnInput = {
  orderId: string;
  buyerId: string;
  productId: string;
  quantity: number;
  reason: string;
};

export const ReturnService = {
  async registerReturn(input: RegisterReturnInput): Promise<ReturnRequest> {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new ValidationError("La cantidad a devolver debe ser un número entero mayor a cero.");
    }
    if (typeof input.reason !== "string" || input.reason.trim() === "") {
      throw new ValidationError("El motivo de la devolución es obligatorio.");
    }

    return transaction(async () => {
      // Bloquea el pedido: dos solicitudes simultáneas se validan una después de la otra,
      // así entre las dos nunca superan las unidades compradas.
      await OrderService.lockOrder(input.orderId);
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
      const alreadyReturned = await ReturnRepository.sumActiveQuantity(input.orderId, input.productId);
      const returnable = orderItem.quantity - alreadyReturned;
      if (input.quantity > returnable) {
        throw new ValidationError(
          `Cantidad inválida. Unidades que aún se pueden devolver de este producto: ${returnable}.`
        );
      }

      return ReturnRepository.create({
        id: randomUUID(),
        orderId: input.orderId,
        productId: input.productId,
        quantity: input.quantity,
        reason: input.reason,
        status: ReturnStatus.REQUESTED,
        createdAt: new Date(),
      });
    });
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

    const order = await OrderService.getOrderById(request.orderId);
    const orderItem = order.items.find((item) => item.productId === request.productId);
    if (!orderItem) {
      throw new ValidationError("El producto de la devolución no existe en el pedido.");
    }

    const newStatus = approve ? ReturnStatus.APPROVED : ReturnStatus.REJECTED;

    // Todo o nada: estado de la devolución, reingreso al inventario y reembolso
    await transaction(async () => {
      // Se "reclama" la devolución primero: si otra petición ya la procesó, esta no hace nada
      if (!(await ReturnRepository.updateStatusIf(returnId, ReturnStatus.REQUESTED, newStatus))) {
        throw new ConflictError("Esta devolución ya fue procesada por otra solicitud.");
      }
      if (!approve) return;

      // La mercancía vuelve a la bodega de la que salió
      await InventoryService.registerReturn(orderItem.productId, orderItem.warehouseId, request.quantity);

      // Reembolso con el precio que se pagó (no el actual del producto)
      await RefundService.generateRefund(request.id, orderItem.unitPrice * request.quantity);
    });

    return this.getReturnById(returnId);
  },
};
