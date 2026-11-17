import { InventoryMovement, MovementType } from "../models/Inventory";
import { InventoryMovementDocument, InventoryMovementModel } from "../db/mongoModels";

// MongoDB: colección inventory_movements. Bitácora que solo crece (nunca se modifica).
// Se escribe con afterCommit (ver InventoryService): un rollback en PostgreSQL no deja
// movimientos que nunca ocurrieron.

function toMovement(doc: InventoryMovementDocument): InventoryMovement {
  return {
    id: doc._id,
    productId: doc.productId,
    warehouseId: doc.warehouseId,
    type: doc.type as MovementType,
    quantity: doc.quantity,
    createdAt: doc.createdAt,
  };
}

export const InventoryMovementRepository = {
  async add(movement: InventoryMovement): Promise<InventoryMovement> {
    const doc = await InventoryMovementModel.create({
      _id: movement.id,
      productId: movement.productId,
      warehouseId: movement.warehouseId,
      type: movement.type,
      quantity: movement.quantity,
      createdAt: movement.createdAt,
    });
    return toMovement(doc.toObject());
  },

  async findByProduct(productId: string): Promise<InventoryMovement[]> {
    const docs = await InventoryMovementModel.find({ productId })
      .sort({ createdAt: 1 })
      .lean<InventoryMovementDocument[]>();
    return docs.map(toMovement);
  },
};
