import { randomUUID } from "crypto";
import { Warehouse, WarehouseType } from "../models/Warehouse";
import { WarehouseRepository } from "../repositories/WarehouseRepository";
import { SellerService } from "./SellerService";
import { NotFoundError, ValidationError } from "../errors/AppError";

type CreateWarehouseInput = {
  type: WarehouseType;
  location: string;
  sellerId?: string;
};

export const WarehouseService = {
  async createWarehouse(input: CreateWarehouseInput): Promise<Warehouse> {
    if (input.type === WarehouseType.SELLER) {
      if (!input.sellerId) {
        throw new ValidationError("Una bodega de tipo SELLER debe tener un vendedor asociado.");
      }
      // Validamos que el vendedor exista realmente
      await SellerService.getSellerByUserId(input.sellerId);
    }

    if (input.type === WarehouseType.MARKETPLACE && input.sellerId) {
      throw new ValidationError(
        "Una bodega de tipo MARKETPLACE no debe tener un vendedor asociado."
      );
    }

    const newWarehouse: Warehouse = {
      id: randomUUID(),
      type: input.type,
      location: input.location,
      ...(input.sellerId ? { sellerId: input.sellerId } : {}),
    };

    return WarehouseRepository.create(newWarehouse);
  },

  async getWarehouseById(id: string): Promise<Warehouse> {
    const warehouse = await WarehouseRepository.findById(id);
    if (!warehouse) {
      throw new NotFoundError("Bodega no encontrada.");
    }
    return warehouse;
  },

  async getWarehousesBySeller(sellerId: string): Promise<Warehouse[]> {
    return WarehouseRepository.findBySellerId(sellerId);
  },

  // Vincula una bodega existente a un vendedor (actualiza ambos lados de la relación)
  async linkToSeller(warehouseId: string, sellerId: string): Promise<Warehouse> {
    const warehouse = await this.getWarehouseById(warehouseId);

    if (warehouse.type !== WarehouseType.SELLER) {
      throw new ValidationError("Solo se pueden vincular bodegas de tipo SELLER a un vendedor.");
    }

    await SellerService.assignWarehouse(sellerId, warehouseId);
    // Antes se mutaba el objeto en memoria sin guardarlo; ahora se persiste explícitamente
    const updated = await WarehouseRepository.update(warehouseId, { sellerId });
    return updated!;
  },
};
