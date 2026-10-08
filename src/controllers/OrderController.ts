import { Request, Response } from "express";
import { OrderService } from "../services/OrderService";
import { OrderStatus } from "../models/Order";

export const OrderController = {
  checkout(req: Request, res: Response): void {
    try {
      const { buyerId } = req.body as { buyerId: string };
      const order = OrderService.checkout(buyerId);
      res.status(201).json(order);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },

  getById(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      if (typeof id !== "string") {
        res.status(400).json({ message: "El parámetro 'id' es requerido." });
        return;
      }
      const order = OrderService.getOrderById(id);
      res.status(200).json(order);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  },

  getByBuyer(req: Request, res: Response): void {
    try {
      const { buyerId } = req.params;
      if (typeof buyerId !== "string") {
        res.status(400).json({ message: "El parámetro 'buyerId' es requerido." });
        return;
      }
      const orders = OrderService.getOrdersByBuyer(buyerId);
      res.status(200).json(orders);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },

  changeStatus(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      if (typeof id !== "string") {
        res.status(400).json({ message: "El parámetro 'id' es requerido." });
        return;
      }
      const { status } = req.body as { status: OrderStatus };
      const updated = OrderService.changeStatus(id, status);
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },
};