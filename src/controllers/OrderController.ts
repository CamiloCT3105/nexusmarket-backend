import { Request, Response } from "express";
import { OrderService } from "../services/OrderService";
import { Order, OrderStatus } from "../models/Order";
import { AuthUser } from "../models/AuthUser";
import { UserRole } from "../models/User";
import { getAuthUser } from "../middlewares/authenticate";
import { ForbiddenError } from "../errors/AppError";
import { requireParam } from "../utils/params";

// Un BUYER solo accede a sus propios pedidos; los demás roles ya fueron filtrados por la ruta
function canAccessOrder(authUser: AuthUser, order: Order): boolean {
  return authUser.role !== UserRole.BUYER || order.buyerId === authUser.id;
}

export const OrderController = {
  async checkout(_req: Request, res: Response): Promise<void> {
    // El comprador es SIEMPRE quien está autenticado: no se lee del body
    const authUser = getAuthUser(res);
    const order = await OrderService.checkout(authUser.id);
    res.status(201).json(order);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const order = await OrderService.getOrderById(requireParam(req, "id"));
    if (!canAccessOrder(getAuthUser(res), order)) {
      throw new ForbiddenError("Solo puedes consultar tus propios pedidos.");
    }
    res.status(200).json(order);
  },

  async getByBuyer(req: Request, res: Response): Promise<void> {
    const orders = await OrderService.getOrdersByBuyer(requireParam(req, "buyerId"));
    res.status(200).json(orders);
  },

  async pay(req: Request, res: Response): Promise<void> {
    const id = requireParam(req, "id");
    const order = await OrderService.getOrderById(id);
    if (!canAccessOrder(getAuthUser(res), order)) {
      throw new ForbiddenError("Solo puedes pagar tus propios pedidos.");
    }

    const updated = await OrderService.changeStatus(id, OrderStatus.PAID);
    res.status(200).json(updated);
  },

  async changeStatus(req: Request, res: Response): Promise<void> {
    const { status } = req.body as { status: OrderStatus };
    const updated = await OrderService.changeStatus(requireParam(req, "id"), status);
    res.status(200).json(updated);
  },
};
