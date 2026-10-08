import { Request, Response } from "express";
import { WarehouseService } from "../services/WarehouseService";
import { WarehouseType } from "../models/Warehouse";
import { UserRole } from "../models/User";
import { getAuthUser } from "../middlewares/authenticate";

export const WarehouseController = {
  create(req: Request, res: Response): void {
    try {
      const authUser = getAuthUser(res);
      const { type, location, sellerId } = req.body as {
        type: WarehouseType;
        location: string;
        sellerId?: string;
      };

      let ownerId = sellerId;
      if (authUser.role === UserRole.SELLER) {
        // Un vendedor solo crea bodegas propias; las de MARKETPLACE son de la plataforma
        if (type !== WarehouseType.SELLER) {
          res.status(403).json({ message: "Un vendedor solo puede crear bodegas de tipo SELLER." });
          return;
        }
        ownerId = authUser.id;
      }

      const warehouse = WarehouseService.createWarehouse({
        type,
        location,
        ...(ownerId ? { sellerId: ownerId } : {}),
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
      const authUser = getAuthUser(res);
      if (authUser.role === UserRole.SELLER && warehouse.sellerId !== authUser.id) {
        res.status(403).json({ message: "Solo puedes consultar tus propias bodegas." });
        return;
      }

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