import { Request, Response } from "express";
import { WarehouseService } from "../services/WarehouseService";
import { WarehouseType } from "../models/Warehouse";

export const WarehouseController = {
  create(req: Request, res: Response): void {
    try {
        const { type, location, sellerId } = req.body as {
        type: WarehouseType;
        location: string;
        sellerId?: string;
        };

        const warehouse = WarehouseService.createWarehouse({
        type,
        location,
        ...(sellerId ? { sellerId } : {}),
        });

        res.status(201).json(warehouse);
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
      const warehouse = WarehouseService.getWarehouseById(id);
      res.status(200).json(warehouse);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  },

  getBySeller(req: Request, res: Response): void {
    try {
      const { sellerId } = req.params;
      if (typeof sellerId !== "string") {
        res.status(400).json({ message: "El parámetro 'sellerId' es requerido." });
        return;
      }
      const warehouses = WarehouseService.getWarehousesBySeller(sellerId);
      res.status(200).json(warehouses);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },

  linkToSeller(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      if (typeof id !== "string") {
        res.status(400).json({ message: "El parámetro 'id' es requerido." });
        return;
      }
      const { sellerId } = req.body as { sellerId: string };
      const updated = WarehouseService.linkToSeller(id, sellerId);
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },
};