import { randomUUID } from "crypto";
import { Invoice } from "../models/Invoice";
import { OrderStatus } from "../models/Order";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { OrderService } from "./OrderService";

export const InvoiceService = {
  generateInvoice(orderId: string): Invoice {
    const order = OrderService.getOrderById(orderId); // valida que el pedido exista

    if (order.status === OrderStatus.PENDING_PAYMENT) {
      throw new Error("Solo se puede facturar un pedido que ya fue pagado.");
    }

    const existingInvoice = InvoiceRepository.findByOrderId(orderId);
    if (existingInvoice) {
      throw new Error("Este pedido ya tiene una factura generada.");
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

  getInvoiceById(id: string): Invoice {
    const invoice = InvoiceRepository.findById(id);
    if (!invoice) {
      throw new Error("Factura no encontrada.");
    }
    return invoice;
  },

  getInvoiceByOrder(orderId: string): Invoice {
    const invoice = InvoiceRepository.findByOrderId(orderId);
    if (!invoice) {
      throw new Error("No existe una factura para este pedido.");
    }
    return invoice;
  },
};