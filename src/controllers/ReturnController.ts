import { Request, Response } from "express";
import { ReturnService } from "../services/ReturnService";
import { OrderService } from "../services/OrderService";
import { ProductService } from "../services/ProductService";
import { ReturnRequest } from "../models/ReturnRequest";
import { AuthUser } from "../models/AuthUser";
import { UserRole } from "../models/User";
import { getAuthUser } from "../middlewares/authenticate";

// Quién puede ver o procesar una devolución concreta:
// - ADMIN y SUPERVISOR: cualquiera
// - BUYER: solo las de sus propios pedidos
// - SELLER: solo las de productos que le pertenecen
function canAccessReturn(authUser: AuthUser, request: ReturnRequest): boolean {
  switch (authUser.role) {
    case UserRole.ADMIN:
    case UserRole.SUPERVISOR:
      return true;
    case UserRole.BUYER:
      return OrderService.getOrderById(request.orderId).buyerId === authUser.id;
    case UserRole.SELLER:
      return ProductService.getProductById(request.productId).sellerId === authUser.id;
    default:
      return false;
  }
}

export const ReturnController = {
  register(req: Request, res: Response): void {
    try {
      const authUser = getAuthUser(res);
      const { orderId, productId, quantity, reason } = req.body as {
        orderId: string;
        productId: string;
        quantity: number;
        reason: string;
      };
      // El comprador sale del token: nadie puede pedir devoluciones a nombre de otro
      const request = ReturnService.registerReturn({
        orderId,
        buyerId: authUser.id,
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
      if (!canAccessReturn(getAuthUser(res), request)) {
        res.status(403).json({ message: "No tienes permisos para ver esta devolución." });
        return;
      }

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

      const authUser = getAuthUser(res);
      if (
        authUser.role === UserRole.BUYER &&
        OrderService.getOrderById(orderId).buyerId !== authUser.id
      ) {
        res.status(403).json({ message: "Solo puedes consultar las devoluciones de tus pedidos." });
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

      const { approve } = req.body as { approve: boolean };
      if (typeof approve !== "boolean") {
        res.status(400).json({ message: "El campo 'approve' debe ser true o false." });
        return;
      }

      const request = ReturnService.getReturnById(id);
      if (!canAccessReturn(getAuthUser(res), request)) {
        res.status(403).json({ message: "Solo puedes procesar devoluciones de tus propios productos." });
        return;
      }

      const updated = ReturnService.processReturn(id, approve);
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },
};