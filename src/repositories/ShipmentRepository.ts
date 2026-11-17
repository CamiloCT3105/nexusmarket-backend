import { Shipment, ShipmentEvent, ShipmentStatus } from "../models/Shipment";
import { db } from "../db/transaction";
import { Prisma } from "../generated/prisma/client";
import { isUuid } from "../db/ids";

// PostgreSQL: tablas shipments + shipment_events (historial, una fila por cambio de estado)

const shipmentWithEvents = {
  include: { events: { orderBy: { createdAt: "asc" } } },
} satisfies Prisma.ShipmentDefaultArgs;

type ShipmentRow = Prisma.ShipmentGetPayload<typeof shipmentWithEvents>;

function toShipment(row: ShipmentRow): Shipment {
  return {
    id: row.id,
    orderId: row.orderId,
    trackingCode: row.trackingCode,
    status: row.status as ShipmentStatus,
    events: row.events.map(
      (event): ShipmentEvent => ({
        status: event.status as ShipmentStatus,
        note: event.note,
        createdAt: event.createdAt,
      })
    ),
  };
}

export const ShipmentRepository = {
  async findById(id: string): Promise<Shipment | undefined> {
    if (!isUuid(id)) return undefined;
    const row = await db().shipment.findUnique({ where: { id }, ...shipmentWithEvents });
    return row ? toShipment(row) : undefined;
  },

  async findByOrderId(orderId: string): Promise<Shipment | undefined> {
    if (!isUuid(orderId)) return undefined;
    const row = await db().shipment.findUnique({ where: { orderId }, ...shipmentWithEvents });
    return row ? toShipment(row) : undefined;
  },

  async findAll(): Promise<Shipment[]> {
    const rows = await db().shipment.findMany(shipmentWithEvents);
    return rows.map(toShipment);
  },

  async create(shipment: Shipment): Promise<Shipment> {
    const row = await db().shipment.create({
      data: {
        id: shipment.id,
        orderId: shipment.orderId,
        trackingCode: shipment.trackingCode,
        status: shipment.status,
        events: { create: shipment.events },
      },
      ...shipmentWithEvents,
    });
    return toShipment(row);
  },

  // Cambia el estado SOLO si el envío sigue en `from` (dos cambios simultáneos: gana uno)
  async updateStatusIf(id: string, from: ShipmentStatus, to: ShipmentStatus): Promise<boolean> {
    if (!isUuid(id)) return false;
    const result = await db().shipment.updateMany({ where: { id, status: from }, data: { status: to } });
    return result.count === 1;
  },

  async addEvent(shipmentId: string, event: ShipmentEvent): Promise<void> {
    await db().shipmentEvent.create({ data: { ...event, shipmentId } });
  },
};
