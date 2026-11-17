import { Request, Response } from "express";
import { ShipmentService } from "../services/ShipmentService";
import { OrderService } from "../services/OrderService";
import { Shipment, ShipmentStatus } from "../models/Shipment";
import { AuthUser } from "../models/AuthUser";
import { UserRole } from "../models/User";
import { getAuthUser } from "../middlewares/authenticate";
import { ForbiddenError } from "../errors/AppError";
import { requireParam } from "../utils/params";
import { optionalEnum, pageRequest } from "../utils/query";

// Un BUYER solo puede ver el envío de sus propios pedidos
async function assertShipmentAccess(authUser: AuthUser, shipment: Shipment): Promise<void> {
  if (authUser.role !== UserRole.BUYER) return;
  const order = await OrderService.getOrderById(shipment.orderId);
  if (order.buyerId !== authUser.id) {
    throw new ForbiddenError("Solo puedes consultar los envíos de tus propios pedidos.");
  }
}

export const ShipmentController = {
  // GET /api/shipments?status=&page=&pageSize=
  async list(req: Request, res: Response): Promise<void> {
    const page = await ShipmentService.listShipmentsPage(
      { status: optionalEnum(req, "status", Object.values(ShipmentStatus)) },
      pageRequest(req)
    );
    res.status(200).json(page);
  },

  async create(req: Request, res: Response): Promise<void> {
    const { orderId } = req.body as { orderId: string };
    const shipment = await ShipmentService.createShipment(orderId);
    res.status(201).json(shipment);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const shipment = await ShipmentService.getShipmentById(requireParam(req, "id"));
    await assertShipmentAccess(getAuthUser(res), shipment);
    res.status(200).json(shipment);
  },

  async getByOrder(req: Request, res: Response): Promise<void> {
    const shipment = await ShipmentService.getShipmentByOrder(requireParam(req, "orderId"));
    await assertShipmentAccess(getAuthUser(res), shipment);
    res.status(200).json(shipment);
  },

  async updateStatus(req: Request, res: Response): Promise<void> {
    const { status, note } = req.body as { status: ShipmentStatus; note?: string };
    const updated = await ShipmentService.updateStatus(requireParam(req, "id"), status, note);
    res.status(200).json(updated);
  },
};
