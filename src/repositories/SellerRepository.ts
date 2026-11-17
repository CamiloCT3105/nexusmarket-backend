import { Seller } from "../models/Seller";
import { clone } from "./clone";

const sellers: Seller[] = [];

export const SellerRepository = {
  async findAll(): Promise<Seller[]> {
    return clone(sellers);
  },

  async findByUserId(userId: string): Promise<Seller | undefined> {
    const seller = sellers.find((s) => s.userId === userId);
    return seller && clone(seller);
  },

  async create(seller: Seller): Promise<Seller> {
    sellers.push(clone(seller));
    return clone(seller);
  },

  async update(userId: string, updatedFields: Partial<Seller>): Promise<Seller | undefined> {
    const seller = sellers.find((s) => s.userId === userId);
    if (!seller) return undefined;

    Object.assign(seller, clone(updatedFields));
    return clone(seller);
  },
};
