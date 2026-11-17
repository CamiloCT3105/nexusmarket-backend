import { Request, Response } from "express";
import { WarehouseService } from "../services/WarehouseService";
import { WarehouseType } from "../models/Warehouse";
import { UserRole } from "../models/User";
import { getAuthUser } from "../middlewares/authenticate";
import { ForbiddenError } from "../errors/AppError";
import { requireParam } from "../utils/params";
import { optionalEnum, optionalString, pageRequest } from "../utils/query";

export const WarehouseController = {
  // GET /api/warehouses?type=&sellerId=&page=&pageSize=
  async list(req: Request, res: Response): Promise<void> {
    const page = await WarehouseService.listWarehousesPage(
      {
        type: optionalEnum(req, "type", Object.values(WarehouseType)),
        sellerId: optionalString(req, "sellerId"),
      },
      pageRequest(req)
    );
    res.status(200).json(page);
  },

  async create(req: Request, res: Response): Promise<void> {
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
        throw new ForbiddenError("Un vendedor solo puede crear bodegas de tipo SELLER.");
      }
      ownerId = authUser.id;
    }

    const warehouse = await WarehouseService.createWarehouse({
      type,
      location,
      ...(ownerId ? { sellerId: ownerId } : {}),
    });

    res.status(201).json(warehouse);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const warehouse = await WarehouseService.getWarehouseById(requireParam(req, "id"));
    const authUser = getAuthUser(res);
    if (authUser.role === UserRole.SELLER && warehouse.sellerId !== authUser.id) {
      throw new ForbiddenError("Solo puedes consultar tus propias bodegas.");
    }

    res.status(200).json(warehouse);
  },

  async getBySeller(req: Request, res: Response): Promise<void> {
    const warehouses = await WarehouseService.getWarehousesBySeller(requireParam(req, "sellerId"));
    res.status(200).json(warehouses);
  },

  async linkToSeller(req: Request, res: Response): Promise<void> {
    const { sellerId } = req.body as { sellerId: string };
    const updated = await WarehouseService.linkToSeller(requireParam(req, "id"), sellerId);
    res.status(200).json(updated);
  },
};
