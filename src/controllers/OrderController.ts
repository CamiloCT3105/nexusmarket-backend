import { Request, Response } from "express";
import { OrderService } from "../services/OrderService";
import { Order, OrderStatus } from "../models/Order";
import { AuthUser } from "../models/AuthUser";
import { UserRole } from "../models/User";
import { getAuthUser } from "../middlewares/authenticate";
import { ForbiddenError } from "../errors/AppError";
import { requireParam } from "../utils/params";
import { optionalDateRange, optionalEnum, optionalString, pageRequest } from "../utils/query";

// Un BUYER solo accede a sus propios pedidos; los demás roles ya fueron filtrados por la ruta
function canAccessOrder(authUser: AuthUser, order: Order): boolean {
  return authUser.role !== UserRole.BUYER || order.buyerId === authUser.id;
}

export const OrderController = {
  // POST /api/orders/checkout  { addressIndex?: number }  (0 = dirección principal, por defecto)
  async checkout(req: Request, res: Response): Promise<void> {
    // El comprador es SIEMPRE quien está autenticado: no se lee del body
    const authUser = getAuthUser(res);
    const { addressIndex } = (req.body ?? {}) as { addressIndex?: unknown };
    const order = await OrderService.checkout(authUser.id, addressIndex ?? 0);
    res.status(201).json(order);
  },

  // GET /api/orders?status=&buyerId=&from=&to=&page=&pageSize=  (visibilidad según el rol)
  async list(req: Request, res: Response): Promise<void> {
    const page = await OrderService.listOrdersForViewer(
      getAuthUser(res),
      {
        status: optionalEnum(req, "status", Object.values(OrderStatus)),
        buyerId: optionalString(req, "buyerId"),
        ...optionalDateRange(req),
      },
      pageRequest(req)
    );
    res.status(200).json(page);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const order = await OrderService.getOrderForViewer(getAuthUser(res), requireParam(req, "id"));
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
