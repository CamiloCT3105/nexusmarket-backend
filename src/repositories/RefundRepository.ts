import { Refund } from "../models/Refund";

const refunds: Refund[] = [];

export const RefundRepository = {
  findById(id: string): Refund | undefined {
    return refunds.find((refund) => refund.id === id);
  },

  findByReturnId(returnId: string): Refund | undefined {
    return refunds.find((refund) => refund.returnId === returnId);
  },

  create(refund: Refund): Refund {
    refunds.push(refund);
    return refund;
  },

  update(id: string, updatedFields: Partial<Refund>): Refund | undefined {
    const refund = this.findById(id);
    if (!refund) return undefined;

    Object.assign(refund, updatedFields);
    return refund;
  },
};