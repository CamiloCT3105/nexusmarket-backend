import { Request, Response } from "express";
import { InvoiceService } from "../services/InvoiceService";
import { Invoice } from "../models/Invoice";
import { AuthUser } from "../models/AuthUser";
import { UserRole } from "../models/User";
import { getAuthUser } from "../middlewares/authenticate";

// Un BUYER solo puede ver sus propias facturas
function canAccessInvoice(authUser: AuthUser, invoice: Invoice): boolean {
  return authUser.role !== UserRole.BUYER || invoice.buyerId === authUser.id;
}

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
      if (!canAccessInvoice(getAuthUser(res), invoice)) {
        res.status(403).json({ message: "Solo puedes consultar tus propias facturas." });
        return;
      }

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
      if (!canAccessInvoice(getAuthUser(res), invoice)) {
        res.status(403).json({ message: "Solo puedes consultar tus propias facturas." });
        return;
      }

      res.status(200).json(invoice);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  },
};