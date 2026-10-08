import { Seller } from "../models/Seller";
import { SellerRepository } from "../repositories/SellerRepository";
import { UserService } from "./UserService";
import { UserRole } from "../models/User";

type OnboardSellerInput = {
  userId: string;
};

export const SellerService = {
  onboardSeller(input: OnboardSellerInput): Seller {
    const user = UserService.getUserById(input.userId);

    if (user.role !== UserRole.SELLER) {
      throw new Error("El usuario debe tener el rol SELLER para ser incorporado como vendedor.");
    }

    const existingSeller = SellerRepository.findByUserId(input.userId);
    if (existingSeller) {
      throw new Error("Este usuario ya está registrado como vendedor.");
    }

    const newSeller: Seller = {
      userId: input.userId,
      warehouseIds: [],
    };

    return SellerRepository.create(newSeller);
  },

  getSellerByUserId(userId: string): Seller {
    const seller = SellerRepository.findByUserId(userId);
    if (!seller) {
      throw new Error("Vendedor no encontrado.");
    }
    return seller;
  },

  assignWarehouse(userId: string, warehouseId: string): Seller {
    const seller = this.getSellerByUserId(userId);
    const updatedWarehouses = [...seller.warehouseIds, warehouseId];
    const updated = SellerRepository.update(userId, { warehouseIds: updatedWarehouses });
    return updated!;
  },
};