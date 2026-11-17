import { Invoice } from "../models/Invoice";
import { clone } from "./clone";

const invoices: Invoice[] = [];

export const InvoiceRepository = {
  async findById(id: string): Promise<Invoice | undefined> {
    const invoice = invoices.find((i) => i.id === id);
    return invoice && clone(invoice);
  },

  async findByOrderId(orderId: string): Promise<Invoice | undefined> {
    const invoice = invoices.find((i) => i.orderId === orderId);
    return invoice && clone(invoice);
  },

  async findAll(): Promise<Invoice[]> {
    return clone(invoices);
  },

  async create(invoice: Invoice): Promise<Invoice> {
    invoices.push(clone(invoice));
    return clone(invoice);
  },
};
