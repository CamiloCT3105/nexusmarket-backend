import { Request, Response } from "express";
import { ShipmentService } from "../services/ShipmentService";
import { OrderService } from "../services/OrderService";
import { Shipment, ShipmentStatus } from "../models/Shipment";
import { AuthUser } from "../models/AuthUser";
import { UserRole } from "../models/User";
import { getAuthUser } from "../middlewares/authenticate";

// Un BUYER solo puede ver el envío de sus propios pedidos
function canViewShipment(authUser: AuthUser, shipment: Shipment): boolean {
  if (authUser.role !== UserRole.BUYER) return true;
  return OrderService.getOrderById(shipment.orderId).buyerId === authUser.id;
}

export const ShipmentController = {
  create(req: Request, res: Response): void {
    try {
      const { orderId } = req.body as { orderId: string };
      const shipment = ShipmentService.createShipment(orderId);
      res.status(201).json(shipment);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },

  getById(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      if (typeof id !== "string") {
        res.status(400).json({ message: "El parámetro 'id' es requerido." });
        return;
      }

      const shipment = ShipmentService.getShipmentById(id);
      if (!canViewShipment(getAuthUser(res), shipment)) {
        res.status(403).json({ message: "Solo puedes consultar los envíos de tus propios pedidos." });
        return;
      }

      res.status(200).json(shipment);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  },

  getByOrder(req: Request, res: Response): void {
    try {
      const { orderId } = req.params;
      if (typeof orderId !== "string") {
        res.status(400).json({ message: "El parámetro 'orderId' es requerido." });
        return;
      }

      const shipment = ShipmentService.getShipmentByOrder(orderId);
      if (!canViewShipment(getAuthUser(res), shipment)) {
        res.status(403).json({ message: "Solo puedes consultar los envíos de tus propios pedidos." });
        return;
      }

      res.status(200).json(shipment);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  },

  updateStatus(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      if (typeof id !== "string") {
        res.status(400).json({ message: "El parámetro 'id' es requerido." });
        return;
      }
      const { status, note } = req.body as { status: ShipmentStatus; note?: string };
      const updated = ShipmentService.updateStatus(id, status, note);
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },
};