import { Seller } from "../models/Seller";

const sellers: Seller[] = [];

export const SellerRepository = {
  findAll(): Seller[] {
    return sellers;
  },

  findByUserId(userId: string): Seller | undefined {
    return sellers.find((seller) => seller.userId === userId);
  },

  create(seller: Seller): Seller {
    sellers.push(seller);
    return seller;
  },

  update(userId: string, updatedFields: Partial<Seller>): Seller | undefined {
    const seller = this.findByUserId(userId);
    if (!seller) return undefined;

    Object.assign(seller, updatedFields);
    return seller;
  },
};