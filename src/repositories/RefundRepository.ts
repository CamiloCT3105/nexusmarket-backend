import { Refund } from "../models/Refund";
import { clone } from "./clone";

const refunds: Refund[] = [];

export const RefundRepository = {
  async findById(id: string): Promise<Refund | undefined> {
    const refund = refunds.find((r) => r.id === id);
    return refund && clone(refund);
  },

  async findByReturnId(returnId: string): Promise<Refund | undefined> {
    const refund = refunds.find((r) => r.returnId === returnId);
    return refund && clone(refund);
  },

  async findAll(): Promise<Refund[]> {
    return clone(refunds);
  },

  async create(refund: Refund): Promise<Refund> {
    refunds.push(clone(refund));
    return clone(refund);
  },

  async update(id: string, updatedFields: Partial<Refund>): Promise<Refund | undefined> {
    const refund = refunds.find((r) => r.id === id);
    if (!refund) return undefined;

    Object.assign(refund, clone(updatedFields));
    return clone(refund);
  },
};
