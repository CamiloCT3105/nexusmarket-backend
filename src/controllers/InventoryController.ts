import { Request, Response } from "express";
import { InventoryService } from "../services/InventoryService";
import { AuthUser } from "../models/AuthUser";
import { UserRole } from "../models/User";
import { WarehouseService } from "../services/WarehouseService";
import { getAuthUser } from "../middlewares/authenticate";
import { ForbiddenError } from "../errors/AppError";
import { requireParam } from "../utils/params";
import { optionalString, pageRequest } from "../utils/query";

type StockMovementBody = {
  productId: string;
  warehouseId: string;
  quantity: number;
};

// Un SELLER solo puede operar sobre sus propias bodegas; los demás roles
// que llegan hasta aquí ya fueron filtrados por la ruta.
async function assertWarehouseAccess(
  authUser: AuthUser,
  warehouseId: string,
  message: string
): Promise<void> {
  if (authUser.role !== UserRole.SELLER) return;
  const warehouse = await WarehouseService.getWarehouseById(warehouseId);
  if (warehouse.sellerId !== authUser.id) {
    throw new ForbiddenError(message);
  }
}

export const InventoryController = {
  // GET /api/inventory?productId=&warehouseId=&page=&pageSize=  (el vendedor, solo sus bodegas)
  async list(req: Request, res: Response): Promise<void> {
    const page = await InventoryService.listInventoryForViewer(
      getAuthUser(res),
      { productId: optionalString(req, "productId"), warehouseId: optionalString(req, "warehouseId") },
      pageRequest(req)
    );
    res.status(200).json(page);
  },

  async registerInbound(req: Request, res: Response): Promise<void> {
    const { productId, warehouseId, quantity } = req.body as StockMovementBody;
    await assertWarehouseAccess(
      getAuthUser(res),
      warehouseId,
      "Solo puedes operar sobre tus propias bodegas."
    );

    const item = await InventoryService.registerInbound(productId, warehouseId, quantity);
    res.status(201).json(item);
  },

  async reserveStock(req: Request, res: Response): Promise<void> {
    const { productId, warehouseId, quantity } = req.body as StockMovementBody;
    const item = await InventoryService.reserveStock(productId, warehouseId, quantity);
    res.status(200).json(item);
  },

  async confirmOutbound(req: Request, res: Response): Promise<void> {
    const { productId, warehouseId, quantity } = req.body as StockMovementBody;
    const item = await InventoryService.confirmOutbound(productId, warehouseId, quantity);
    res.status(200).json(item);
  },

  async markAsDamaged(req: Request, res: Response): Promise<void> {
    const { productId, warehouseId, quantity } = req.body as StockMovementBody;
    await assertWarehouseAccess(
      getAuthUser(res),
      warehouseId,
      "Solo puedes operar sobre tus propias bodegas."
    );

    const item = await InventoryService.markAsDamaged(productId, warehouseId, quantity);
    res.status(200).json(item);
  },

  async registerReturn(req: Request, res: Response): Promise<void> {
    const { productId, warehouseId, quantity } = req.body as StockMovementBody;
    const item = await InventoryService.registerReturn(productId, warehouseId, quantity);
    res.status(200).json(item);
  },

  async getAvailability(req: Request, res: Response): Promise<void> {
    const productId = requireParam(req, "productId");
    const warehouseId = requireParam(req, "warehouseId");
    await assertWarehouseAccess(
      getAuthUser(res),
      warehouseId,
      "Solo puedes consultar tus propias bodegas."
    );

    const item = await InventoryService.getAvailability(productId, warehouseId);
    res.status(200).json(item);
  },
};
