import { Request, Response } from "express";
import { OrderService } from "../services/OrderService";
import { Order, OrderStatus } from "../models/Order";
import { AuthUser } from "../models/AuthUser";
import { UserRole } from "../models/User";
import { getAuthUser } from "../middlewares/authenticate";

// Un BUYER solo accede a sus propios pedidos; los demás roles ya fueron filtrados por la ruta
function canAccessOrder(authUser: AuthUser, order: Order): boolean {
  return authUser.role !== UserRole.BUYER || order.buyerId === authUser.id;
}

export const OrderController = {
  checkout(_req: Request, res: Response): void {
    try {
      // El comprador es SIEMPRE quien está autenticado: ya no se lee del body
      const authUser = getAuthUser(res);
      const order = OrderService.checkout(authUser.id);
      res.status(201).json(order);
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

      const order = OrderService.getOrderById(id);
      if (!canAccessOrder(getAuthUser(res), order)) {
        res.status(403).json({ message: "Solo puedes consultar tus propios pedidos." });
        return;
      }

      res.status(200).json(order);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  },

  getByBuyer(req: Request, res: Response): void {
    try {
      const { buyerId } = req.params;
      if (typeof buyerId !== "string") {
        res.status(400).json({ message: "El parámetro 'buyerId' es requerido." });
        return;
      }
      const orders = OrderService.getOrdersByBuyer(buyerId);
      res.status(200).json(orders);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },

  pay(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      if (typeof id !== "string") {
        res.status(400).json({ message: "El parámetro 'id' es requerido." });
        return;
      }

      const order = OrderService.getOrderById(id);
      if (!canAccessOrder(getAuthUser(res), order)) {
        res.status(403).json({ message: "Solo puedes pagar tus propios pedidos." });
        return;
      }

      const updated = OrderService.changeStatus(id, OrderStatus.PAID);
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },

  changeStatus(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      if (typeof id !== "string") {
        res.status(400).json({ message: "El parámetro 'id' es requerido." });
        return;
      }
      const { status } = req.body as { status: OrderStatus };
      const updated = OrderService.changeStatus(id, status);
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },
};