import { Buyer } from "../models/Buyer";
import { clone } from "./clone";

const buyers: Buyer[] = [];

export const BuyerRepository = {
  async findAll(): Promise<Buyer[]> {
    return clone(buyers);
  },

  async findByUserId(userId: string): Promise<Buyer | undefined> {
    const buyer = buyers.find((b) => b.userId === userId);
    return buyer && clone(buyer);
  },

  async create(buyer: Buyer): Promise<Buyer> {
    buyers.push(clone(buyer));
    return clone(buyer);
  },

  async update(userId: string, updatedFields: Partial<Buyer>): Promise<Buyer | undefined> {
    const buyer = buyers.find((b) => b.userId === userId);
    if (!buyer) return undefined;

    Object.assign(buyer, clone(updatedFields));
    return clone(buyer);
  },
};
