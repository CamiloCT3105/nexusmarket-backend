import { Request, Response } from "express";
import { ShipmentService } from "../services/ShipmentService";
import { ShipmentStatus } from "../models/Shipment";
import { UserRole } from "../models/User";

export const ShipmentController = {
  create(req: Request, res: Response): void {
    try {
      const { orderId, actingUserRole } = req.body as {
        orderId: string;
        actingUserRole: UserRole;
      };
      const shipment = ShipmentService.createShipment(orderId, actingUserRole);
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
      const { status, note, actingUserRole } = req.body as {
        status: ShipmentStatus;
        note?: string;
        actingUserRole: UserRole;
      };
      const updated = ShipmentService.updateStatus(id, status, actingUserRole, note);
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },
};