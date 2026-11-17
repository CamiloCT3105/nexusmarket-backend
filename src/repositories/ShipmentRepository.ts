import { Shipment } from "../models/Shipment";
import { clone } from "./clone";

const shipments: Shipment[] = [];

export const ShipmentRepository = {
  async findById(id: string): Promise<Shipment | undefined> {
    const shipment = shipments.find((s) => s.id === id);
    return shipment && clone(shipment);
  },

  async findByOrderId(orderId: string): Promise<Shipment | undefined> {
    const shipment = shipments.find((s) => s.orderId === orderId);
    return shipment && clone(shipment);
  },

  async findAll(): Promise<Shipment[]> {
    return clone(shipments);
  },

  async create(shipment: Shipment): Promise<Shipment> {
    shipments.push(clone(shipment));
    return clone(shipment);
  },

  async update(id: string, updatedFields: Partial<Shipment>): Promise<Shipment | undefined> {
    const shipment = shipments.find((s) => s.id === id);
    if (!shipment) return undefined;

    Object.assign(shipment, clone(updatedFields));
    return clone(shipment);
  },
};
