import { randomUUID } from "crypto";
import { Warehouse, WarehouseType } from "../models/Warehouse";
import { WarehouseRepository } from "../repositories/WarehouseRepository";
import { SellerService } from "./SellerService";

type CreateWarehouseInput = {
  type: WarehouseType;
  location: string;
  sellerId?: string;
};

export const WarehouseService = {
  createWarehouse(input: CreateWarehouseInput): Warehouse {
    if (input.type === WarehouseType.SELLER) {
      if (!input.sellerId) {
        throw new Error("Una bodega de tipo SELLER debe tener un vendedor asociado.");
      }
      // Validamos que el vendedor exista realmente
      SellerService.getSellerByUserId(input.sellerId);
    }

    if (input.type === WarehouseType.MARKETPLACE && input.sellerId) {
      throw new Error("Una bodega de tipo MARKETPLACE no debe tener un vendedor asociado.");
    }

    const newWarehouse: Warehouse = {
      id: randomUUID(),
      type: input.type,
      location: input.location,
      ...(input.sellerId ? { sellerId: input.sellerId } : {}),
    };

    return WarehouseRepository.create(newWarehouse);
  },

  getWarehouseById(id: string): Warehouse {
    const warehouse = WarehouseRepository.findById(id);
    if (!warehouse) {
      throw new Error("Bodega no encontrada.");
    }
    return warehouse;
  },

  getWarehousesBySeller(sellerId: string): Warehouse[] {
    return WarehouseRepository.findBySellerId(sellerId);
  },

  // Vincula una bodega existente a un vendedor (actualiza ambos lados de la relación)
  linkToSeller(warehouseId: string, sellerId: string): Warehouse {
    const warehouse = this.getWarehouseById(warehouseId);

    if (warehouse.type !== WarehouseType.SELLER) {
      throw new Error("Solo se pueden vincular bodegas de tipo SELLER a un vendedor.");
    }

    SellerService.assignWarehouse(sellerId, warehouseId);
    warehouse.sellerId = sellerId;
    return warehouse;
  },
};