import { Shipment } from "../models/Shipment";

const shipments: Shipment[] = [];

export const ShipmentRepository = {
  findById(id: string): Shipment | undefined {
    return shipments.find((shipment) => shipment.id === id);
  },

  findByOrderId(orderId: string): Shipment | undefined {
    return shipments.find((shipment) => shipment.orderId === orderId);
  },

  create(shipment: Shipment): Shipment {
    shipments.push(shipment);
    return shipment;
  },

  update(id: string, updatedFields: Partial<Shipment>): Shipment | undefined {
    const shipment = this.findById(id);
    if (!shipment) return undefined;

    Object.assign(shipment, updatedFields);
    return shipment;
  },
};