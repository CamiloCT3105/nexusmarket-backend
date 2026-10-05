import { InventoryItem, InventoryMovement } from "../models/Inventory";

const inventoryItems: InventoryItem[] = [];
const movements: InventoryMovement[] = [];

export const InventoryRepository = {
  findItem(productId: string, warehouseId: string): InventoryItem | undefined {
    return inventoryItems.find(
      (item) => item.productId === productId && item.warehouseId === warehouseId
    );
  },

  createItem(item: InventoryItem): InventoryItem {
    inventoryItems.push(item);
    return item;
  },

  updateItem(
    productId: string,
    warehouseId: string,
    updatedFields: Partial<InventoryItem>
  ): InventoryItem | undefined {
    const item = this.findItem(productId, warehouseId);
    if (!item) return undefined;

    Object.assign(item, updatedFields);
    return item;
  },

  addMovement(movement: InventoryMovement): InventoryMovement {
    movements.push(movement);
    return movement;
  },

  getMovementsByProduct(productId: string): InventoryMovement[] {
    return movements.filter((m) => m.productId === productId);
  },
};