import { Request, Response } from "express";
import { CartService } from "../services/CartService";
import { requireParam } from "../utils/params";

export const CartController = {
  async getCart(req: Request, res: Response): Promise<void> {
    const cart = await CartService.getOrCreateCart(requireParam(req, "buyerId"));
    res.status(200).json(cart);
  },

  async addItem(req: Request, res: Response): Promise<void> {
    const buyerId = requireParam(req, "buyerId");
    const { productId, quantity } = req.body as { productId: string; quantity: number };
    const cart = await CartService.addItem(buyerId, productId, quantity);
    res.status(200).json(cart);
  },

  async removeItem(req: Request, res: Response): Promise<void> {
    const cart = await CartService.removeItem(
      requireParam(req, "buyerId"),
      requireParam(req, "productId")
    );
    res.status(200).json(cart);
  },

  async updateQuantity(req: Request, res: Response): Promise<void> {
    const { quantity } = req.body as { quantity: number };
    const cart = await CartService.updateQuantity(
      requireParam(req, "buyerId"),
      requireParam(req, "productId"),
      quantity
    );
    res.status(200).json(cart);
  },
};
