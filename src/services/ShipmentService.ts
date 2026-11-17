import { randomUUID } from "crypto";
import { Shipment, ShipmentEvent, ShipmentStatus } from "../models/Shipment";
import { OrderStatus } from "../models/Order";
import { ShipmentRepository } from "../repositories/ShipmentRepository";
import { OrderService } from "./OrderService";
import { ConflictError, NotFoundError, ValidationError } from "../errors/AppError";

// Ciclo de vida válido del envío. DELIVERED es estado final.
const allowedTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
  [ShipmentStatus.PREPARING]: [ShipmentStatus.IN_TRANSIT],
  [ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.DELIVERED],
  [ShipmentStatus.DELIVERED]: [],
};

export const ShipmentService = {
  async createShipment(orderId: string): Promise<Shipment> {
    const order = await OrderService.getOrderById(orderId);
    if (order.status !== OrderStatus.PAID) {
      throw new ValidationError("Solo se puede crear un envío para un pedido en estado PAID.");
    }

    const existingShipment = await ShipmentRepository.findByOrderId(orderId);
    if (existingShipment) {
      throw new ConflictError("Este pedido ya tiene un envío creado.");
    }

    const firstEvent: ShipmentEvent = {
      status: ShipmentStatus.PREPARING,
      note: "Envío creado, en preparación.",
      createdAt: new Date(),
    };

    const shipment: Shipment = {
      id: randomUUID(),
      orderId,
      trackingCode: `NX-${randomUUID().slice(0, 8).toUpperCase()}`,
      status: ShipmentStatus.PREPARING,
      events: [firstEvent],
    };

    return ShipmentRepository.create(shipment);
  },

  async getShipmentById(id: string): Promise<Shipment> {
    const shipment = await ShipmentRepository.findById(id);
    if (!shipment) {
      throw new NotFoundError("Envío no encontrado.");
    }
    return shipment;
  },

  async getShipmentByOrder(orderId: string): Promise<Shipment> {
    const shipment = await ShipmentRepository.findByOrderId(orderId);
    if (!shipment) {
      throw new NotFoundError("No existe un envío para este pedido.");
    }
    return shipment;
  },

  async listShipments(): Promise<Shipment[]> {
    return ShipmentRepository.findAll();
  },

  async updateStatus(shipmentId: string, newStatus: ShipmentStatus, note?: string): Promise<Shipment> {
    const shipment = await this.getShipmentById(shipmentId);

    if (!allowedTransitions[shipment.status].includes(newStatus)) {
      throw new ValidationError(
        `Transición inválida: no se puede pasar de ${shipment.status} a ${newStatus}.`
      );
    }

    // Primero sincronizamos el pedido: si falla (por ejemplo, por inventario),
    // el envío no cambia y no quedan los dos módulos desincronizados.
    if (newStatus === ShipmentStatus.IN_TRANSIT) {
      await OrderService.changeStatus(shipment.orderId, OrderStatus.SHIPPED);
    }
    if (newStatus === ShipmentStatus.DELIVERED) {
      await OrderService.changeStatus(shipment.orderId, OrderStatus.DELIVERED);
    }

    const event: ShipmentEvent = {
      status: newStatus,
      note: note ?? "",
      createdAt: new Date(),
    };

    return (await ShipmentRepository.update(shipmentId, {
      status: newStatus,
      events: [...shipment.events, event],
    }))!;
  },

  async confirmDelivery(shipmentId: string, note?: string): Promise<Shipment> {
    return this.updateStatus(shipmentId, ShipmentStatus.DELIVERED, note);
  },
};
