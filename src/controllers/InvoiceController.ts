import { Request, Response } from "express";
import { InvoiceService } from "../services/InvoiceService";

export const InvoiceController = {
  generate(req: Request, res: Response): void {
    try {
      const { orderId } = req.body as { orderId: string };
      const invoice = InvoiceService.generateInvoice(orderId);
      res.status(201).json(invoice);
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
      const invoice = InvoiceService.getInvoiceById(id);
      res.status(200).json(invoice);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  },

  getByOrder(req: Request, res: Response): void {
    try {
      const { orderId } = req.params;
      if (typeof orderId !== "string") {
        res.status(400).json({ message: "El parámetro 'orderId' es requerido." });
        return;
      }
      const invoice = InvoiceService.getInvoiceByOrder(orderId);
      res.status(200).json(invoice);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  },
};