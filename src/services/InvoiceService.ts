import { randomUUID } from "crypto";
import { Invoice } from "../models/Invoice";
import { OrderStatus } from "../models/Order";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { OrderService } from "./OrderService";
import { ConflictError, NotFoundError, ValidationError } from "../errors/AppError";
import { AuthUser } from "../models/AuthUser";
import { UserRole } from "../models/User";
import { Page, PageRequest } from "../utils/pagination";

export const InvoiceService = {
  async generateInvoice(orderId: string): Promise<Invoice> {
    const order = await OrderService.getOrderById(orderId); // valida que el pedido exista

    if (order.status === OrderStatus.PENDING_PAYMENT) {
      throw new ValidationError("Solo se puede facturar un pedido que ya fue pagado.");
    }

    const existingInvoice = await InvoiceRepository.findByOrderId(orderId);
    if (existingInvoice) {
      throw new ConflictError("Este pedido ya tiene una factura generada.");
    }

    const invoice: Invoice = {
      id: randomUUID(),
      orderId,
      buyerId: order.buyerId,
      amount: order.total,
      issuedAt: new Date(),
    };

    return InvoiceRepository.create(invoice);
  },

  async getInvoiceById(id: string): Promise<Invoice> {
    const invoice = await InvoiceRepository.findById(id);
    if (!invoice) {
      throw new NotFoundError("Factura no encontrada.");
    }
    return invoice;
  },

  async getInvoiceByOrder(orderId: string): Promise<Invoice> {
    const invoice = await InvoiceRepository.findByOrderId(orderId);
    if (!invoice) {
      throw new NotFoundError("No existe una factura para este pedido.");
    }
    return invoice;
  },

  // El comprador ve solo sus facturas; administrador y supervisor, todas
  async listInvoicesForViewer(viewer: AuthUser, request: PageRequest): Promise<Page<Invoice>> {
    const buyerId = viewer.role === UserRole.BUYER ? viewer.id : undefined;
    return InvoiceRepository.findPage({ buyerId }, request);
  },

  async listInvoices(): Promise<Invoice[]> {
    return InvoiceRepository.findAll();
  },
};
