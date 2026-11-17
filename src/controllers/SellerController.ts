import { Request, Response } from "express";
import { SellerService } from "../services/SellerService";
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

  async assignWarehouse(req: Request, res: Response): Promise<void> {
    const { warehouseId } = req.body as { warehouseId: string };
    const updated = await SellerService.assignWarehouse(requireParam(req, "userId"), warehouseId);
    res.status(200).json(updated);
  },
};
