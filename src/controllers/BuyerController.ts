import { Request, Response } from "express";
import { BuyerService } from "../services/BuyerService";
import { CommercialStatus, Address } from "../models/Buyer";
import { getAuthUser } from "../middlewares/authenticate";
import { requireParam } from "../utils/params";

export const BuyerController = {
  async register(req: Request, res: Response): Promise<void> {
    const authUser = getAuthUser(res);
    const { primaryAddress } = req.body as { primaryAddress: Address };
    const buyer = await BuyerService.registerBuyer({ userId: authUser.id, primaryAddress });
    res.status(201).json(buyer);
  },

  async getByUserId(req: Request, res: Response): Promise<void> {
    const buyer = await BuyerService.getBuyerByUserId(requireParam(req, "userId"));
    res.status(200).json(buyer);
  },

  async addAddress(req: Request, res: Response): Promise<void> {
    const address = req.body as Address;
    const updated = await BuyerService.addAddress(requireParam(req, "userId"), address);
    res.status(200).json(updated);
  },

  async updateCommercialStatus(req: Request, res: Response): Promise<void> {
    const { commercialStatus } = req.body as { commercialStatus: CommercialStatus };
    const updated = await BuyerService.updateCommercialStatus(
      requireParam(req, "userId"),
      commercialStatus
    );
    res.status(200).json(updated);
  },
};
