import { randomUUID } from "crypto";
import { InventoryItem, InventoryMovement, MovementType } from "../models/Inventory";
import { InventoryRepository } from "../repositories/InventoryRepository";
import { InventoryMovementRepository } from "../repositories/InventoryMovementRepository";
import { ProductService } from "./ProductService";
import { WarehouseService } from "./WarehouseService";
import { NotFoundError, ValidationError } from "../errors/AppError";
import { afterCommit } from "../db/transaction";

const NO_INVENTORY_MESSAGE = "No existe inventario registrado para este producto en esta bodega.";

// Las cantidades son unidades enteras: ni cero, ni negativas, ni fracciones
function assertPositiveInteger(quantity: unknown, label: string): asserts quantity is number {
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) {
    throw new ValidationError(`La cantidad ${label} debe ser un número entero mayor a cero.`);
  }
}

export const InventoryService = {
  // Registra ingreso de mercancía (o crea el registro de inventario si no existe)
  async registerInbound(productId: string, warehouseId: string, quantity: number): Promise<InventoryItem> {
    assertPositiveInteger(quantity, "de ingreso");

    // Validamos que producto y bodega existan realmente
    await ProductService.getProductById(productId);
    await WarehouseService.getWarehouseById(warehouseId);

    const updated = await InventoryRepository.addQuantity(productId, warehouseId, quantity);
    await this.recordMovement(productId, warehouseId, MovementType.INBOUND, quantity);
    return updated;
  },

  // Calcula cuánto stock realmente se puede reservar (función pura, no consulta datos)
  getAvailableQuantity(item: InventoryItem): number {
    return item.quantity - item.reservedQuantity - item.damagedQuantity;
  },

  async reserveStock(productId: string, warehouseId: string, quantity: number): Promise<InventoryItem> {
    assertPositiveInteger(quantity, "a reservar");
    await this.getAvailability(productId, warehouseId); // 404 si no hay registro

    if (!(await InventoryRepository.tryReserve(productId, warehouseId, quantity))) {
      // Releemos para informar el disponible real en este momento
      const current = await this.getAvailability(productId, warehouseId);
      throw new ValidationError(
        `Stock insuficiente para reservar. Disponible: ${this.getAvailableQuantity(current)}, solicitado: ${quantity}.`
      );
    }

    await this.recordMovement(productId, warehouseId, MovementType.RESERVE, quantity);
    return this.getAvailability(productId, warehouseId);
  },

  // Confirma la salida de mercancía previamente reservada (ej: al despachar un pedido)
  async confirmOutbound(productId: string, warehouseId: string, quantity: number): Promise<InventoryItem> {
    assertPositiveInteger(quantity, "a despachar");
    await this.getAvailability(productId, warehouseId);

    if (!(await InventoryRepository.tryConfirmOutbound(productId, warehouseId, quantity))) {
      throw new ValidationError("No se puede despachar más cantidad de la que está reservada.");
    }

    await this.recordMovement(productId, warehouseId, MovementType.OUTBOUND, quantity);
    return this.getAvailability(productId, warehouseId);
  },

  // Marca unidades como dañadas (no se pueden reservar ni vender)
  async markAsDamaged(productId: string, warehouseId: string, quantity: number): Promise<InventoryItem> {
    assertPositiveInteger(quantity, "dañada");
    await this.getAvailability(productId, warehouseId);

    if (!(await InventoryRepository.tryMarkDamaged(productId, warehouseId, quantity))) {
      throw new ValidationError(
        "No hay suficiente stock sin dañar para marcar esa cantidad como dañada."
      );
    }

    await this.recordMovement(productId, warehouseId, MovementType.ADJUSTMENT, quantity);
    return this.getAvailability(productId, warehouseId);
  },

  async registerReturn(productId: string, warehouseId: string, quantity: number): Promise<InventoryItem> {
    assertPositiveInteger(quantity, "devuelta");

    if (!(await InventoryRepository.addReturnedQuantity(productId, warehouseId, quantity))) {
      throw new NotFoundError(NO_INVENTORY_MESSAGE);
    }

    await this.recordMovement(productId, warehouseId, MovementType.RETURN, quantity);
    return this.getAvailability(productId, warehouseId);
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

  // Busca, entre las bodegas indicadas, la primera que tenga stock disponible suficiente.
  // Es solo una consulta: la reserva real (atómica) la hace reserveStock.
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

  // Registra el movimiento en la bitácora cuando la transacción (si la hay) se confirme
  async recordMovement(
    productId: string,
    warehouseId: string,
    type: MovementType,
    quantity: number
  ): Promise<void> {
    const movement: InventoryMovement = {
      id: randomUUID(),
      productId,
      warehouseId,
      type,
      quantity,
      createdAt: new Date(),
    };
    await afterCommit(() => InventoryMovementRepository.add(movement));
  },
};
