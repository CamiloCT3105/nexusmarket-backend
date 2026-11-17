import { InventoryMovement } from "../models/Inventory";
import { clone } from "./clone";

// Bitácora de movimientos de inventario. Solo crece: irá a MongoDB.
// Mientras tanto vive en memoria. Se escribe con afterCommit (ver InventoryService)
// para que un rollback en PostgreSQL no deje movimientos que nunca ocurrieron.
const movements: InventoryMovement[] = [];

export const InventoryMovementRepository = {
  async add(movement: InventoryMovement): Promise<InventoryMovement> {
    movements.push(clone(movement));
    return clone(movement);
  },

  async findByProduct(productId: string): Promise<InventoryMovement[]> {
    return clone(movements.filter((m) => m.productId === productId));
  },
};
