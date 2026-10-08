import { Invoice } from "../models/Invoice";

const invoices: Invoice[] = [];

export const InvoiceRepository = {
  findById(id: string): Invoice | undefined {
    return invoices.find((invoice) => invoice.id === id);
  },

  findByOrderId(orderId: string): Invoice | undefined {
    return invoices.find((invoice) => invoice.orderId === orderId);
  },

  create(invoice: Invoice): Invoice {
    invoices.push(invoice);
    return invoice;
  },
};