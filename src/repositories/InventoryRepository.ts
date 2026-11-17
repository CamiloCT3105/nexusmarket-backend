import { InventoryItem, InventoryMovement } from "../models/Inventory";
import { clone } from "./clone";

const inventoryItems: InventoryItem[] = [];
const movements: InventoryMovement[] = [];

function findStored(productId: string, warehouseId: string): InventoryItem | undefined {
  return inventoryItems.find(
    (item) => item.productId === productId && item.warehouseId === warehouseId
  );
}

export const InventoryRepository = {
  async findItem(productId: string, warehouseId: string): Promise<InventoryItem | undefined> {
    const item = findStored(productId, warehouseId);
    return item && clone(item);
  },

  async findAllItems(): Promise<InventoryItem[]> {
    return clone(inventoryItems);
  },

  async createItem(item: InventoryItem): Promise<InventoryItem> {
    inventoryItems.push(clone(item));
    return clone(item);
  },

  async updateItem(
    productId: string,
    warehouseId: string,
    updatedFields: Partial<InventoryItem>
  ): Promise<InventoryItem | undefined> {
    const item = findStored(productId, warehouseId);
    if (!item) return undefined;

    Object.assign(item, clone(updatedFields));
    return clone(item);
  },

  async addMovement(movement: InventoryMovement): Promise<InventoryMovement> {
    movements.push(clone(movement));
    return clone(movement);
  },

  async getMovementsByProduct(productId: string): Promise<InventoryMovement[]> {
    return clone(movements.filter((m) => m.productId === productId));
  },
};
