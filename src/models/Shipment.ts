export enum ShipmentStatus {
  PREPARING = "PREPARING",
  IN_TRANSIT = "IN_TRANSIT",
  DELIVERED = "DELIVERED",
}

export interface ShipmentEvent {
  status: ShipmentStatus;
  note: string;
  createdAt: Date;
}

export interface Shipment {
  id: string;
  orderId: string;
  trackingCode: string;
  status: ShipmentStatus;
  events: ShipmentEvent[];
}