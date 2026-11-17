import { Seller } from "../models/Seller";
import { SellerRepository } from "../repositories/SellerRepository";
import { UserService } from "./UserService";
import { UserRole } from "../models/User";
import { ConflictError, NotFoundError, ValidationError } from "../errors/AppError";

type OnboardSellerInput = {
  userId: string;
};

// Las bodegas de un vendedor se vinculan con WarehouseService.linkToSeller:
// warehouseIds se calcula a partir de las bodegas, no se guarda aparte.
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

    return SellerRepository.create({ userId: input.userId });
  },

  async getSellerByUserId(userId: string): Promise<Seller> {
    const seller = await SellerRepository.findByUserId(userId);
    if (!seller) {
      throw new NotFoundError("Vendedor no encontrado.");
    }
    return seller;
  },
};
