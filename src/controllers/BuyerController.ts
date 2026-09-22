import { Request, Response } from "express";
import { BuyerService } from "../services/BuyerService";
import { CommercialStatus, Address } from "../models/Buyer";

export const BuyerController = {
  register(req: Request, res: Response): void {
    try {
      const { userId, primaryAddress } = req.body as {
        userId: string;
        primaryAddress: Address;
      };
      const buyer = BuyerService.registerBuyer({ userId, primaryAddress });
      res.status(201).json(buyer);
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
      const buyer = BuyerService.getBuyerByUserId(userId);
      res.status(200).json(buyer);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  },

  addAddress(req: Request, res: Response): void {
    try {
      const { userId } = req.params;
      if (typeof userId !== "string") {
        res.status(400).json({ message: "El parámetro 'userId' es requerido." });
        return;
      }
      const address = req.body as Address;
      const updated = BuyerService.addAddress(userId, address);
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },

  updateCommercialStatus(req: Request, res: Response): void {
    try {
      const { userId } = req.params;
      if (typeof userId !== "string") {
        res.status(400).json({ message: "El parámetro 'userId' es requerido." });
        return;
      }
      const { commercialStatus } = req.body as { commercialStatus: CommercialStatus };
      const updated = BuyerService.updateCommercialStatus(userId, commercialStatus);
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },
};