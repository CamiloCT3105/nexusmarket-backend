import { randomUUID } from "crypto";
import { InventoryItem, InventoryMovement, MovementType } from "../models/Inventory";
import { InventoryRepository } from "../repositories/InventoryRepository";
import { ProductService } from "./ProductService";
import { WarehouseService } from "./WarehouseService";
import { NotFoundError, ValidationError } from "../errors/AppError";

const NO_INVENTORY_MESSAGE = "No existe inventario registrado para este producto en esta bodega.";

export const InventoryService = {
  // Registra ingreso de mercancía (o crea el registro de inventario si no existe)
  async registerInbound(productId: string, warehouseId: string, quantity: number): Promise<InventoryItem> {
    if (quantity <= 0) {
      throw new ValidationError("La cantidad de ingreso debe ser mayor a cero.");
    }

    // Validamos que producto y bodega existan realmente
    await ProductService.getProductById(productId);
    await WarehouseService.getWarehouseById(warehouseId);

    let item = await InventoryRepository.findItem(productId, warehouseId);

    if (!item) {
      item = await InventoryRepository.createItem({
        productId,
        warehouseId,
        quantity: 0,
        reservedQuantity: 0,
        damagedQuantity: 0,
      });
    }

    const updated = (await InventoryRepository.updateItem(productId, warehouseId, {
      quantity: item.quantity + quantity,
    }))!;

    await this.recordMovement(productId, warehouseId, MovementType.INBOUND, quantity);
    return updated;
  },

  // Calcula cuánto stock realmente se puede reservar (función pura, no consulta datos)
  getAvailableQuantity(item: InventoryItem): number {
    return item.quantity - item.reservedQuantity - item.damagedQuantity;
  },

  async reserveStock(productId: string, warehouseId: string, quantity: number): Promise<InventoryItem> {
    if (quantity <= 0) {
      throw new ValidationError("La cantidad a reservar debe ser mayor a cero.");
    }

    const item = await this.getAvailability(productId, warehouseId);

    const available = this.getAvailableQuantity(item);
    if (quantity > available) {
      throw new ValidationError(
        `Stock insuficiente para reservar. Disponible: ${available}, solicitado: ${quantity}.`
      );
    }

    const updated = (await InventoryRepository.updateItem(productId, warehouseId, {
      reservedQuantity: item.reservedQuantity + quantity,
    }))!;

    await this.recordMovement(productId, warehouseId, MovementType.RESERVE, quantity);
    return updated;
  },

  // Confirma la salida de mercancía previamente reservada (ej: al despachar un pedido)
  async confirmOutbound(productId: string, warehouseId: string, quantity: number): Promise<InventoryItem> {
    const item = await this.getAvailability(productId, warehouseId);

    if (quantity > item.reservedQuantity) {
      throw new ValidationError("No se puede despachar más cantidad de la que está reservada.");
    }

    const updated = (await InventoryRepository.updateItem(productId, warehouseId, {
      quantity: item.quantity - quantity,
      reservedQuantity: item.reservedQuantity - quantity,
    }))!;

    await this.recordMovement(productId, warehouseId, MovementType.OUTBOUND, quantity);
    return updated;
  },

  // Marca unidades como dañadas (no se pueden reservar ni vender)
  async markAsDamaged(productId: string, warehouseId: string, quantity: number): Promise<InventoryItem> {
    const item = await this.getAvailability(productId, warehouseId);

    const availableNonDamaged = item.quantity - item.damagedQuantity;
    if (quantity > availableNonDamaged) {
      throw new ValidationError(
        "No hay suficiente stock sin dañar para marcar esa cantidad como dañada."
      );
    }

    const updated = (await InventoryRepository.updateItem(productId, warehouseId, {
      damagedQuantity: item.damagedQuantity + quantity,
    }))!;

    await this.recordMovement(productId, warehouseId, MovementType.ADJUSTMENT, quantity);
    return updated;
  },

  async registerReturn(productId: string, warehouseId: string, quantity: number): Promise<InventoryItem> {
    const item = await this.getAvailability(productId, warehouseId);

    const updated = (await InventoryRepository.updateItem(productId, warehouseId, {
      quantity: item.quantity + quantity,
    }))!;

    await this.recordMovement(productId, warehouseId, MovementType.RETURN, quantity);
    return updated;
  },

  async getAvailability(productId: string, warehouseId: string): Promise<InventoryItem> {
    const item = await InventoryRepository.findItem(productId, warehouseId);
    if (!item) {
      throw new NotFoundError(NO_INVENTORY_MESSAGE);
    }
    return item;
  },

  async listItems(): Promise<InventoryItem[]> {
    return InventoryRepository.findAllItems();
  },

  // Busca, entre las bodegas indicadas, la primera que tenga stock disponible suficiente
  async findWarehouseWithStock(
    productId: string,
    warehouseIds: string[],
    quantity: number
  ): Promise<string | undefined> {
    for (const warehouseId of warehouseIds) {
      const item = await InventoryRepository.findItem(productId, warehouseId);
      if (item && this.getAvailableQuantity(item) >= quantity) {
        return warehouseId;
      }
    }
    return undefined;
  },

  // Método de apoyo: registra cada movimiento en la bitácora
  async recordMovement(
    productId: string,
    warehouseId: string,
    type: MovementType,
    quantity: number
  ): Promise<InventoryMovement> {
    const movement: InventoryMovement = {
      id: randomUUID(),
      productId,
      warehouseId,
      type,
      quantity,
      createdAt: new Date(),
    };
    return InventoryRepository.addMovement(movement);
  },
};
