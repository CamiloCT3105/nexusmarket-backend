import { Buyer, CommercialStatus, Address } from "../models/Buyer";
import { BuyerRepository } from "../repositories/BuyerRepository";
import { UserService } from "./UserService";
import { UserRole } from "../models/User";

type RegisterBuyerInput = {
  userId: string;
  primaryAddress: Address;
};

export const BuyerService = {
  registerBuyer(input: RegisterBuyerInput): Buyer {
    // Validamos que el usuario base exista (lanza error si no)
    const user = UserService.getUserById(input.userId);

    if (user.role !== UserRole.BUYER) {
      throw new Error("El usuario debe tener el rol BUYER para registrarse como comprador.");
    }

    const existingBuyer = BuyerRepository.findByUserId(input.userId);
    if (existingBuyer) {
      throw new Error("Este usuario ya está registrado como comprador.");
    }

    const newBuyer: Buyer = {
      userId: input.userId,
      primaryAddress: input.primaryAddress,
      additionalAddresses: [],
      commercialStatus: CommercialStatus.ACTIVE,
    };

    return BuyerRepository.create(newBuyer);
  },

  getBuyerByUserId(userId: string): Buyer {
    const buyer = BuyerRepository.findByUserId(userId);
    if (!buyer) {
      throw new Error("Comprador no encontrado.");
    }
    return buyer;
  },

  addAddress(userId: string, address: Address): Buyer {
    this.getBuyerByUserId(userId); // valida que exista
    const updatedAddresses = [...this.getBuyerByUserId(userId).additionalAddresses, address];
    const updated = BuyerRepository.update(userId, { additionalAddresses: updatedAddresses });
    return updated!;
  },

  updateCommercialStatus(userId: string, status: CommercialStatus): Buyer {
    this.getBuyerByUserId(userId);
    const updated = BuyerRepository.update(userId, { commercialStatus: status });
    return updated!;
  },
};