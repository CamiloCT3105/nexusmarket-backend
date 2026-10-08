import { randomUUID } from "crypto";
import { InventoryItem, InventoryMovement, MovementType } from "../models/Inventory";
import { InventoryRepository } from "../repositories/InventoryRepository";
import { ProductService } from "./ProductService";
import { WarehouseService } from "./WarehouseService";

export const InventoryService = {
  // Registra ingreso de mercancía (o crea el registro de inventario si no existe)
  registerInbound(productId: string, warehouseId: string, quantity: number): InventoryItem {
    if (quantity <= 0) {
      throw new Error("La cantidad de ingreso debe ser mayor a cero.");
    }

    // Validamos que producto y bodega existan realmente
    ProductService.getProductById(productId);
    WarehouseService.getWarehouseById(warehouseId);

    let item = InventoryRepository.findItem(productId, warehouseId);

    if (!item) {
      item = InventoryRepository.createItem({
        productId,
        warehouseId,
        quantity: 0,
        reservedQuantity: 0,
        damagedQuantity: 0,
      });
    }

    const updated = InventoryRepository.updateItem(productId, warehouseId, {
      quantity: item.quantity + quantity,
    })!;

    this.recordMovement(productId, warehouseId, MovementType.INBOUND, quantity);
    return updated;
  },

  // Calcula cuánto stock realmente se puede reservar
  getAvailableQuantity(item: InventoryItem): number {
    return item.quantity - item.reservedQuantity - item.damagedQuantity;
  },

  reserveStock(productId: string, warehouseId: string, quantity: number): InventoryItem {
    if (quantity <= 0) {
      throw new Error("La cantidad a reservar debe ser mayor a cero.");
    }

    const item = InventoryRepository.findItem(productId, warehouseId);
    if (!item) {
      throw new Error("No existe inventario registrado para este producto en esta bodega.");
    }

    const available = this.getAvailableQuantity(item);
    if (quantity > available) {
      throw new Error(
        `Stock insuficiente para reservar. Disponible: ${available}, solicitado: ${quantity}.`
      );
    }

    const updated = InventoryRepository.updateItem(productId, warehouseId, {
      reservedQuantity: item.reservedQuantity + quantity,
    })!;

    this.recordMovement(productId, warehouseId, MovementType.RESERVE, quantity);
    return updated;
  },

  // Confirma la salida de mercancía previamente reservada (ej: al despachar un pedido)
  confirmOutbound(productId: string, warehouseId: string, quantity: number): InventoryItem {
    const item = InventoryRepository.findItem(productId, warehouseId);
    if (!item) {
      throw new Error("No existe inventario registrado para este producto en esta bodega.");
    }

    if (quantity > item.reservedQuantity) {
      throw new Error("No se puede despachar más cantidad de la que está reservada.");
    }

    const updated = InventoryRepository.updateItem(productId, warehouseId, {
      quantity: item.quantity - quantity,
      reservedQuantity: item.reservedQuantity - quantity,
    })!;

    this.recordMovement(productId, warehouseId, MovementType.OUTBOUND, quantity);
    return updated;
  },

  // Marca unidades como dañadas (no se pueden reservar ni vender)
  markAsDamaged(productId: string, warehouseId: string, quantity: number): InventoryItem {
    const item = InventoryRepository.findItem(productId, warehouseId);
    if (!item) {
      throw new Error("No existe inventario registrado para este producto en esta bodega.");
    }

    const availableNonDamaged = item.quantity - item.damagedQuantity;
    if (quantity > availableNonDamaged) {
      throw new Error("No hay suficiente stock sin dañar para marcar esa cantidad como dañada.");
    }

    const updated = InventoryRepository.updateItem(productId, warehouseId, {
      damagedQuantity: item.damagedQuantity + quantity,
    })!;

    this.recordMovement(productId, warehouseId, MovementType.ADJUSTMENT, quantity);
    return updated;
  },

  registerReturn(productId: string, warehouseId: string, quantity: number): InventoryItem {
    const item = InventoryRepository.findItem(productId, warehouseId);
    if (!item) {
      throw new Error("No existe inventario registrado para este producto en esta bodega.");
    }

    const updated = InventoryRepository.updateItem(productId, warehouseId, {
      quantity: item.quantity + quantity,
    })!;

    this.recordMovement(productId, warehouseId, MovementType.RETURN, quantity);
    return updated;
  },

  getAvailability(productId: string, warehouseId: string): InventoryItem {
    const item = InventoryRepository.findItem(productId, warehouseId);
    if (!item) {
      throw new Error("No existe inventario registrado para este producto en esta bodega.");
    }
    return item;
  },

    // Busca, entre las bodegas indicadas, la primera que tenga stock disponible suficiente
  findWarehouseWithStock(
    productId: string,
    warehouseIds: string[],
    quantity: number
  ): string | undefined {
    for (const warehouseId of warehouseIds) {
      const item = InventoryRepository.findItem(productId, warehouseId);
      if (item && this.getAvailableQuantity(item) >= quantity) {
        return warehouseId;
      }
    }
    return undefined;
  },

  // Método privado de apoyo: registra cada movimiento en la bitácora
  recordMovement(
    productId: string,
    warehouseId: string,
    type: MovementType,
    quantity: number
  ): InventoryMovement {
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