import { Buyer, CommercialStatus, Address } from "../models/Buyer";
import { BuyerRepository } from "../repositories/BuyerRepository";
import { UserService } from "./UserService";
import { UserRole } from "../models/User";
import { ConflictError, NotFoundError, ValidationError } from "../errors/AppError";

type RegisterBuyerInput = {
  userId: string;
  primaryAddress: Address;
};

export const BuyerService = {
  async registerBuyer(input: RegisterBuyerInput): Promise<Buyer> {
    // Validamos que el usuario base exista (lanza error si no)
    const user = await UserService.getUserById(input.userId);

    if (user.role !== UserRole.BUYER) {
      throw new ValidationError(
        "El usuario debe tener el rol BUYER para registrarse como comprador."
      );
    }

    const existingBuyer = await BuyerRepository.findByUserId(input.userId);
    if (existingBuyer) {
      throw new ConflictError("Este usuario ya está registrado como comprador.");
    }

    const newBuyer: Buyer = {
      userId: input.userId,
      primaryAddress: input.primaryAddress,
      additionalAddresses: [],
      commercialStatus: CommercialStatus.ACTIVE,
    };

    return BuyerRepository.create(newBuyer);
  },

  async getBuyerByUserId(userId: string): Promise<Buyer> {
    const buyer = await BuyerRepository.findByUserId(userId);
    if (!buyer) {
      throw new NotFoundError("Comprador no encontrado.");
    }
    return buyer;
  },

  async addAddress(userId: string, address: Address): Promise<Buyer> {
    const buyer = await this.getBuyerByUserId(userId); // valida que exista
    const updatedAddresses = [...buyer.additionalAddresses, address];
    const updated = await BuyerRepository.update(userId, { additionalAddresses: updatedAddresses });
    return updated!;
  },

  async updateCommercialStatus(userId: string, status: CommercialStatus): Promise<Buyer> {
    await this.getBuyerByUserId(userId);
    const updated = await BuyerRepository.update(userId, { commercialStatus: status });
    return updated!;
  },
};
