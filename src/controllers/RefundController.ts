import { Request, Response } from "express";
import { RefundService } from "../services/RefundService";
import { RefundStatus } from "../models/Refund";
import { UserRole } from "../models/User";

export const RefundController = {
  getById(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      if (typeof id !== "string") {
        res.status(400).json({ message: "El parámetro 'id' es requerido." });
        return;
      }
      const refund = RefundService.getRefundById(id);
      res.status(200).json(refund);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  },

  getByReturn(req: Request, res: Response): void {
    try {
      const { returnId } = req.params;
      if (typeof returnId !== "string") {
        res.status(400).json({ message: "El parámetro 'returnId' es requerido." });
        return;
      }
      const refund = RefundService.getRefundByReturn(returnId);
      res.status(200).json(refund);
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
      const { status, actingUserRole } = req.body as {
        status: RefundStatus;
        actingUserRole: UserRole;
      };
      const updated = RefundService.updateStatus(id, status, actingUserRole);
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },
};