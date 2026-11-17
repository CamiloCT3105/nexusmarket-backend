import { Buyer, CommercialStatus, Address } from "../models/Buyer";
import { BuyerRepository } from "../repositories/BuyerRepository";
import { UserService } from "./UserService";
import { UserRole } from "../models/User";
import { ConflictError, NotFoundError, ValidationError } from "../errors/AppError";

type RegisterBuyerInput = {
  userId: string;
  primaryAddress: Address;
};

const ADDRESS_FIELDS = ["street", "city", "country", "postalCode"] as const;

// Una dirección debe traer los cuatro campos como texto no vacío
// (antes de la base de datos, un campo faltante terminaba en un error 500)
function assertValidAddress(address: unknown, label: string): asserts address is Address {
  if (typeof address !== "object" || address === null) {
    throw new ValidationError(`La ${label} es obligatoria.`);
  }
  const record = address as Record<string, unknown>;
  const missing = ADDRESS_FIELDS.filter(
    (field) => typeof record[field] !== "string" || (record[field] as string).trim() === ""
  );
  if (missing.length > 0) {
    throw new ValidationError(`La ${label} debe incluir: ${missing.join(", ")}.`);
  }
}

export const BuyerService = {
  async registerBuyer(input: RegisterBuyerInput): Promise<Buyer> {
    assertValidAddress(input.primaryAddress, "dirección principal");

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
    assertValidAddress(address, "dirección");
    await this.getBuyerByUserId(userId); // valida que exista
    const updated = await BuyerRepository.addAddress(userId, address);
    return updated!;
  },

  async updateCommercialStatus(userId: string, status: CommercialStatus): Promise<Buyer> {
    if (!Object.values(CommercialStatus).includes(status)) {
      throw new ValidationError(
        `Estado comercial inválido. Valores permitidos: ${Object.values(CommercialStatus).join(", ")}.`
      );
    }
    await this.getBuyerByUserId(userId);
    const updated = await BuyerRepository.update(userId, { commercialStatus: status });
    return updated!;
  },
};
