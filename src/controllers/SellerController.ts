import { Request, Response } from "express";
import { SellerService } from "../services/SellerService";
import { WarehouseService } from "../services/WarehouseService";
import { requireParam } from "../utils/params";

export const SellerController = {
  async onboard(req: Request, res: Response): Promise<void> {
    const { userId } = req.body as { userId: string };
    const seller = await SellerService.onboardSeller({ userId });
    res.status(201).json(seller);
  },

  async getByUserId(req: Request, res: Response): Promise<void> {
    const seller = await SellerService.getSellerByUserId(requireParam(req, "userId"));
    res.status(200).json(seller);
  },

  // Vista desde el vendedor de la misma operación que PATCH /warehouses/:id/link-seller
  async assignWarehouse(req: Request, res: Response): Promise<void> {
    const userId = requireParam(req, "userId");
    const { warehouseId } = req.body as { warehouseId: string };
    await WarehouseService.linkToSeller(warehouseId, userId);
    res.status(200).json(await SellerService.getSellerByUserId(userId));
  },
};
