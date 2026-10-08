import { randomUUID } from "crypto";
import { Shipment, ShipmentEvent, ShipmentStatus } from "../models/Shipment";
import { OrderStatus } from "../models/Order";
import { ShipmentRepository } from "../repositories/ShipmentRepository";
import { OrderService } from "./OrderService";

// Ciclo de vida válido del envío. DELIVERED es estado final.
const allowedTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
  [ShipmentStatus.PREPARING]: [ShipmentStatus.IN_TRANSIT],
  [ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.DELIVERED],
  [ShipmentStatus.DELIVERED]: [],
};

export const ShipmentService = {
  createShipment(orderId: string): Shipment {
    const order = OrderService.getOrderById(orderId);
    if (order.status !== OrderStatus.PAID) {
      throw new Error("Solo se puede crear un envío para un pedido en estado PAID.");
    }

    const existingShipment = ShipmentRepository.findByOrderId(orderId);
    if (existingShipment) {
      throw new Error("Este pedido ya tiene un envío creado.");
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

  getShipmentById(id: string): Shipment {
    const shipment = ShipmentRepository.findById(id);
    if (!shipment) {
      throw new Error("Envío no encontrado.");
    }
    return shipment;
  },

  getShipmentByOrder(orderId: string): Shipment {
    const shipment = ShipmentRepository.findByOrderId(orderId);
    if (!shipment) {
      throw new Error("No existe un envío para este pedido.");
    }
    return shipment;
  },

  updateStatus(shipmentId: string, newStatus: ShipmentStatus, note?: string): Shipment {
    const shipment = this.getShipmentById(shipmentId);

    if (!allowedTransitions[shipment.status].includes(newStatus)) {
      throw new Error(
        `Transición inválida: no se puede pasar de ${shipment.status} a ${newStatus}.`
      );
    }

    // Primero sincronizamos el pedido: si falla (por ejemplo, por inventario),
    // el envío no cambia y no quedan los dos módulos desincronizados.
    if (newStatus === ShipmentStatus.IN_TRANSIT) {
      OrderService.changeStatus(shipment.orderId, OrderStatus.SHIPPED);
    }
    if (newStatus === ShipmentStatus.DELIVERED) {
      OrderService.changeStatus(shipment.orderId, OrderStatus.DELIVERED);
    }

    const event: ShipmentEvent = {
      status: newStatus,
      note: note ?? "",
      createdAt: new Date(),
    };

    return ShipmentRepository.update(shipmentId, {
      status: newStatus,
      events: [...shipment.events, event],
    })!;
  },

  confirmDelivery(shipmentId: string, note?: string): Shipment {
    return this.updateStatus(shipmentId, ShipmentStatus.DELIVERED, note);
  },
};