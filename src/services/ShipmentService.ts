import { randomUUID } from "crypto";
import { Shipment, ShipmentEvent, ShipmentStatus } from "../models/Shipment";
import { OrderStatus } from "../models/Order";
import { ShipmentRepository } from "../repositories/ShipmentRepository";
import { OrderService } from "./OrderService";
import { ConflictError, NotFoundError, ValidationError } from "../errors/AppError";
import { transaction } from "../db/transaction";
import { Page, PageRequest } from "../utils/pagination";

// Ciclo de vida válido del envío. DELIVERED es estado final.
const allowedTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
  [ShipmentStatus.PREPARING]: [ShipmentStatus.IN_TRANSIT],
  [ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.DELIVERED],
  [ShipmentStatus.DELIVERED]: [],
};

// Estado del pedido que acompaña a cada estado del envío
const orderStatusFor: Partial<Record<ShipmentStatus, OrderStatus>> = {
  [ShipmentStatus.IN_TRANSIT]: OrderStatus.SHIPPED,
  [ShipmentStatus.DELIVERED]: OrderStatus.DELIVERED,
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

    // order_id es UNIQUE: si dos solicitudes pasan el chequeo a la vez, la base frena la segunda (409)
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

  async listShipmentsPage(filter: { status?: ShipmentStatus | undefined }, request: PageRequest): Promise<Page<Shipment>> {
    return ShipmentRepository.findPage(filter, request);
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

    // Envío, historial y pedido cambian juntos: si el pedido no puede cambiar
    // (por ejemplo, por inventario), el envío tampoco cambia.
    await transaction(async () => {
      if (!(await ShipmentRepository.updateStatusIf(shipmentId, shipment.status, newStatus))) {
        throw new ConflictError("El envío cambió de estado mientras se procesaba. Intenta de nuevo.");
      }

      await ShipmentRepository.addEvent(shipmentId, {
        status: newStatus,
        note: typeof note === "string" ? note : "",
        createdAt: new Date(),
      });

      const orderStatus = orderStatusFor[newStatus];
      if (orderStatus) {
        await OrderService.changeStatus(shipment.orderId, orderStatus);
      }
    });

    return this.getShipmentById(shipmentId);
  },

  async confirmDelivery(shipmentId: string, note?: string): Promise<Shipment> {
    return this.updateStatus(shipmentId, ShipmentStatus.DELIVERED, note);
  },
};
