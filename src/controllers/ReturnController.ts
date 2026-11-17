import { Request, Response } from "express";
import { ReturnService } from "../services/ReturnService";
import { OrderService } from "../services/OrderService";
import { ProductService } from "../services/ProductService";
import { ReturnRequest } from "../models/ReturnRequest";
import { AuthUser } from "../models/AuthUser";
import { UserRole } from "../models/User";
import { getAuthUser } from "../middlewares/authenticate";
import { ForbiddenError, ValidationError } from "../errors/AppError";
import { requireParam } from "../utils/params";

// Quién puede ver o procesar una devolución concreta:
// - ADMIN y SUPERVISOR: cualquiera
// - BUYER: solo las de sus propios pedidos
// - SELLER: solo las de productos que le pertenecen
async function canAccessReturn(authUser: AuthUser, request: ReturnRequest): Promise<boolean> {
  switch (authUser.role) {
    case UserRole.ADMIN:
    case UserRole.SUPERVISOR:
      return true;
    case UserRole.BUYER:
      return (await OrderService.getOrderById(request.orderId)).buyerId === authUser.id;
    case UserRole.SELLER:
      return (await ProductService.getProductById(request.productId)).sellerId === authUser.id;
    default:
      return false;
  }
}

export const ReturnController = {
  async register(req: Request, res: Response): Promise<void> {
    const authUser = getAuthUser(res);
    const { orderId, productId, quantity, reason } = req.body as {
      orderId: string;
      productId: string;
      quantity: number;
      reason: string;
    };
    // El comprador sale del token: nadie puede pedir devoluciones a nombre de otro
    const request = await ReturnService.registerReturn({
      orderId,
      buyerId: authUser.id,
      productId,
      quantity,
      reason,
    });
    res.status(201).json(request);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const request = await ReturnService.getReturnById(requireParam(req, "id"));
    if (!(await canAccessReturn(getAuthUser(res), request))) {
      throw new ForbiddenError("No tienes permisos para ver esta devolución.");
    }
    res.status(200).json(request);
  },

  async getByOrder(req: Request, res: Response): Promise<void> {
    const orderId = requireParam(req, "orderId");
    const authUser = getAuthUser(res);

    if (authUser.role === UserRole.BUYER) {
      const order = await OrderService.getOrderById(orderId);
      if (order.buyerId !== authUser.id) {
        throw new ForbiddenError("Solo puedes consultar las devoluciones de tus pedidos.");
      }
    }

    const requests = await ReturnService.getReturnsByOrder(orderId);
    res.status(200).json(requests);
  },

  async process(req: Request, res: Response): Promise<void> {
    const id = requireParam(req, "id");

    const { approve } = req.body as { approve: boolean };
    if (typeof approve !== "boolean") {
      throw new ValidationError("El campo 'approve' debe ser true o false.");
    }

    const request = await ReturnService.getReturnById(id);
    if (!(await canAccessReturn(getAuthUser(res), request))) {
      throw new ForbiddenError("Solo puedes procesar devoluciones de tus propios productos.");
    }

    const updated = await ReturnService.processReturn(id, approve);
    res.status(200).json(updated);
  },
};
