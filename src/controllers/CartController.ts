import { Request, Response } from "express";
import { CartService } from "../services/CartService";

export const CartController = {
  getCart(req: Request, res: Response): void {
    try {
      const { buyerId } = req.params;
      if (typeof buyerId !== "string") {
        res.status(400).json({ message: "El parámetro 'buyerId' es requerido." });
        return;
      }
      const cart = CartService.getOrCreateCart(buyerId);
      res.status(200).json(cart);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  },

  addItem(req: Request, res: Response): void {
    try {
      const { buyerId } = req.params;
      if (typeof buyerId !== "string") {
        res.status(400).json({ message: "El parámetro 'buyerId' es requerido." });
        return;
      }
      const { productId, quantity } = req.body as { productId: string; quantity: number };
      const cart = CartService.addItem(buyerId, productId, quantity);
      res.status(200).json(cart);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },

  removeItem(req: Request, res: Response): void {
    try {
      const { buyerId, productId } = req.params;
      if (typeof buyerId !== "string" || typeof productId !== "string") {
        res.status(400).json({ message: "Los parámetros 'buyerId' y 'productId' son requeridos." });
        return;
      }
      const cart = CartService.removeItem(buyerId, productId);
      res.status(200).json(cart);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },

  updateQuantity(req: Request, res: Response): void {
    try {
      const { buyerId, productId } = req.params;
      if (typeof buyerId !== "string" || typeof productId !== "string") {
        res.status(400).json({ message: "Los parámetros 'buyerId' y 'productId' son requeridos." });
        return;
      }
      const { quantity } = req.body as { quantity: number };
      const cart = CartService.updateQuantity(buyerId, productId, quantity);
      res.status(200).json(cart);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },
};