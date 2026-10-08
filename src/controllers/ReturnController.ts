import { Request, Response } from "express";
import { ReturnService } from "../services/ReturnService";
import { UserRole } from "../models/User";

export const ReturnController = {
  register(req: Request, res: Response): void {
    try {
      const { orderId, buyerId, productId, quantity, reason } = req.body as {
        orderId: string;
        buyerId: string;
        productId: string;
        quantity: number;
        reason: string;
      };
      const request = ReturnService.registerReturn({
        orderId,
        buyerId,
        productId,
        quantity,
        reason,
      });
      res.status(201).json(request);
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
      const request = ReturnService.getReturnById(id);
      res.status(200).json(request);
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
      const requests = ReturnService.getReturnsByOrder(orderId);
      res.status(200).json(requests);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },

  process(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      if (typeof id !== "string") {
        res.status(400).json({ message: "El parámetro 'id' es requerido." });
        return;
      }
      const { approve, actingUserRole } = req.body as {
        approve: boolean;
        actingUserRole: UserRole;
      };
      if (typeof approve !== "boolean") {
        res.status(400).json({ message: "El campo 'approve' debe ser true o false." });
        return;
      }
      const updated = ReturnService.processReturn(id, approve, actingUserRole);
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },
};