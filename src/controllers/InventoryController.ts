import { Request, Response } from "express";
import { InventoryService } from "../services/InventoryService";

export const InventoryController = {
  registerInbound(req: Request, res: Response): void {
    try {
      const { productId, warehouseId, quantity } = req.body as {
        productId: string;
        warehouseId: string;
        quantity: number;
      };
      const item = InventoryService.registerInbound(productId, warehouseId, quantity);
      res.status(201).json(item);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },

  reserveStock(req: Request, res: Response): void {
    try {
      const { productId, warehouseId, quantity } = req.body as {
        productId: string;
        warehouseId: string;
        quantity: number;
      };
      const item = InventoryService.reserveStock(productId, warehouseId, quantity);
      res.status(200).json(item);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },

  confirmOutbound(req: Request, res: Response): void {
    try {
      const { productId, warehouseId, quantity } = req.body as {
        productId: string;
        warehouseId: string;
        quantity: number;
      };
      const item = InventoryService.confirmOutbound(productId, warehouseId, quantity);
      res.status(200).json(item);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },

  markAsDamaged(req: Request, res: Response): void {
    try {
      const { productId, warehouseId, quantity } = req.body as {
        productId: string;
        warehouseId: string;
        quantity: number;
      };
      const item = InventoryService.markAsDamaged(productId, warehouseId, quantity);
      res.status(200).json(item);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },

  registerReturn(req: Request, res: Response): void {
    try {
      const { productId, warehouseId, quantity } = req.body as {
        productId: string;
        warehouseId: string;
        quantity: number;
      };
      const item = InventoryService.registerReturn(productId, warehouseId, quantity);
      res.status(200).json(item);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },

  getAvailability(req: Request, res: Response): void {
    try {
      const { productId, warehouseId } = req.params;
      if (typeof productId !== "string" || typeof warehouseId !== "string") {
        res.status(400).json({ message: "Los parámetros 'productId' y 'warehouseId' son requeridos." });
        return;
      }
      const item = InventoryService.getAvailability(productId, warehouseId);
      res.status(200).json(item);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  },
};