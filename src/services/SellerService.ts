import { Seller } from "../models/Seller";
import { SellerRepository } from "../repositories/SellerRepository";
import { UserService } from "./UserService";
import { UserRole } from "../models/User";
import { ConflictError, NotFoundError, ValidationError } from "../errors/AppError";

type OnboardSellerInput = {
  userId: string;
};

export const SellerService = {
  async onboardSeller(input: OnboardSellerInput): Promise<Seller> {
    const user = await UserService.getUserById(input.userId);

    if (user.role !== UserRole.SELLER) {
      throw new ValidationError(
        "El usuario debe tener el rol SELLER para ser incorporado como vendedor."
      );
    }

    const existingSeller = await SellerRepository.findByUserId(input.userId);
    if (existingSeller) {
      throw new ConflictError("Este usuario ya está registrado como vendedor.");
    }

    const newSeller: Seller = {
      userId: input.userId,
      warehouseIds: [],
    };

    return SellerRepository.create(newSeller);
  },

  async getSellerByUserId(userId: string): Promise<Seller> {
    const seller = await SellerRepository.findByUserId(userId);
    if (!seller) {
      throw new NotFoundError("Vendedor no encontrado.");
    }
    return seller;
  },

  async assignWarehouse(userId: string, warehouseId: string): Promise<Seller> {
    const seller = await this.getSellerByUserId(userId);
    const updatedWarehouses = [...seller.warehouseIds, warehouseId];
    const updated = await SellerRepository.update(userId, { warehouseIds: updatedWarehouses });
    return updated!;
  },
};
