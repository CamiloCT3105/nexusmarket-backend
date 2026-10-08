import { Request, Response } from "express";
import { SellerService } from "../services/SellerService";

export const SellerController = {
  onboard(req: Request, res: Response): void {
    try {
      const { userId } = req.body as { userId: string };
      const seller = SellerService.onboardSeller({ userId });
      res.status(201).json(seller);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },

  getByUserId(req: Request, res: Response): void {
    try {
      const { userId } = req.params;
      if (typeof userId !== "string") {
        res.status(400).json({ message: "El parámetro 'userId' es requerido." });
        return;
      }
      const seller = SellerService.getSellerByUserId(userId);
      res.status(200).json(seller);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  },

  assignWarehouse(req: Request, res: Response): void {
    try {
      const { userId } = req.params;
      if (typeof userId !== "string") {
        res.status(400).json({ message: "El parámetro 'userId' es requerido." });
        return;
      }
      const { warehouseId } = req.body as { warehouseId: string };
      const updated = SellerService.assignWarehouse(userId, warehouseId);
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },
};