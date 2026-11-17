import { Request, Response } from "express";
import { InvoiceService } from "../services/InvoiceService";
import { Invoice } from "../models/Invoice";
import { AuthUser } from "../models/AuthUser";
import { UserRole } from "../models/User";
import { getAuthUser } from "../middlewares/authenticate";
import { ForbiddenError } from "../errors/AppError";
import { requireParam } from "../utils/params";
import { pageRequest } from "../utils/query";

// Un BUYER solo puede ver sus propias facturas
function assertInvoiceAccess(authUser: AuthUser, invoice: Invoice): void {
  if (authUser.role === UserRole.BUYER && invoice.buyerId !== authUser.id) {
    throw new ForbiddenError("Solo puedes consultar tus propias facturas.");
  }
}

export const InvoiceController = {
  // GET /api/invoices?page=&pageSize=  (el comprador ve solo las suyas)
  async list(req: Request, res: Response): Promise<void> {
    const page = await InvoiceService.listInvoicesForViewer(getAuthUser(res), pageRequest(req));
    res.status(200).json(page);
  },

  async generate(req: Request, res: Response): Promise<void> {
    const { orderId } = req.body as { orderId: string };
    const invoice = await InvoiceService.generateInvoice(orderId);
    res.status(201).json(invoice);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const invoice = await InvoiceService.getInvoiceById(requireParam(req, "id"));
    assertInvoiceAccess(getAuthUser(res), invoice);
    res.status(200).json(invoice);
  },

  async getByOrder(req: Request, res: Response): Promise<void> {
    const invoice = await InvoiceService.getInvoiceByOrder(requireParam(req, "orderId"));
    assertInvoiceAccess(getAuthUser(res), invoice);
    res.status(200).json(invoice);
  },
};
