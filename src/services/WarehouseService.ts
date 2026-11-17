import { randomUUID } from "crypto";
import { Warehouse, WarehouseType } from "../models/Warehouse";
import { WarehouseRepository } from "../repositories/WarehouseRepository";
import { SellerService } from "./SellerService";
import { NotFoundError, ValidationError } from "../errors/AppError";
import { WarehouseFilter } from "../repositories/WarehouseRepository";
import { Page, PageRequest } from "../utils/pagination";

type CreateWarehouseInput = {
  type: WarehouseType;
  location: string;
  sellerId?: string;
};

export const WarehouseService = {
  async createWarehouse(input: CreateWarehouseInput): Promise<Warehouse> {
    if (!Object.values(WarehouseType).includes(input.type)) {
      throw new ValidationError(
        `Tipo de bodega inválido. Valores permitidos: ${Object.values(WarehouseType).join(", ")}.`
      );
    }
    if (typeof input.location !== "string" || input.location.trim() === "") {
      throw new ValidationError("La ubicación de la bodega es obligatoria.");
    }

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

  // Listado para administrador, supervisor y operador logístico (los vendedores usan /seller/:sellerId)
  async listWarehousesPage(filter: WarehouseFilter, request: PageRequest): Promise<Page<Warehouse>> {
    return WarehouseRepository.findPage(filter, request);
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

  // Vincula una bodega existente a un vendedor. Basta con actualizar warehouses.seller_id:
  // la lista de bodegas del vendedor se calcula a partir de ahí.
  async linkToSeller(warehouseId: string, sellerId: string): Promise<Warehouse> {
    const warehouse = await this.getWarehouseById(warehouseId);

    if (warehouse.type !== WarehouseType.SELLER) {
      throw new ValidationError("Solo se pueden vincular bodegas de tipo SELLER a un vendedor.");
    }

    await SellerService.getSellerByUserId(sellerId); // valida que el vendedor exista

    const updated = await WarehouseRepository.update(warehouseId, { sellerId });
    return updated!;
  },
};
