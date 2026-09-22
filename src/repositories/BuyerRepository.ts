import { Buyer } from "../models/Buyer";

const buyers: Buyer[] = [];

export const BuyerRepository = {
  findAll(): Buyer[] {
    return buyers;
  },

  findByUserId(userId: string): Buyer | undefined {
    return buyers.find((buyer) => buyer.userId === userId);
  },

  create(buyer: Buyer): Buyer {
    buyers.push(buyer);
    return buyer;
  },

  update(userId: string, updatedFields: Partial<Buyer>): Buyer | undefined {
    const buyer = this.findByUserId(userId);
    if (!buyer) return undefined;

    Object.assign(buyer, updatedFields);
    return buyer;
  },
};