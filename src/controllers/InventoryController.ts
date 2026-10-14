import { Request, Response } from "express";
import { InventoryService } from "../services/InventoryService";
import { AuthUser } from "../models/AuthUser";
import { UserRole } from "../models/User";
import { WarehouseService } from "../services/WarehouseService";
import { getAuthUser } from "../middlewares/authenticate";

// Un SELLER solo puede operar sobre sus propias bodegas; los demás roles
// que llegan hasta aquí ya fueron filtrados por la ruta.
function canAccessWarehouse(authUser: AuthUser, warehouseId: string): boolean {
  if (authUser.role !== UserRole.SELLER) return true;
  return WarehouseService.getWarehouseById(warehouseId).sellerId === authUser.id;
}

export const InventoryController = {
  registerInbound(req: Request, res: Response): void {
    try {
      const { productId, warehouseId, quantity } = req.body as {
        productId: string;
        warehouseId: string;
        quantity: number;
      };

      if (!canAccessWarehouse(getAuthUser(res), warehouseId)) {
        res.status(403).json({ message: "Solo puedes operar sobre tus propias bodegas." });
        return;
      }

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

      if (!canAccessWarehouse(getAuthUser(res), warehouseId)) {
        res.status(403).json({ message: "Solo puedes operar sobre tus propias bodegas." });
        return;
      }

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

      if (!canAccessWarehouse(getAuthUser(res), warehouseId)) {
        res.status(403).json({ message: "Solo puedes consultar tus propias bodegas." });
        return;
      }

      const item = InventoryService.getAvailability(productId, warehouseId);
      res.status(200).json(item);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  },
};