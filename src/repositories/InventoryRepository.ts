import { InventoryItem } from "../models/Inventory";
import { db } from "../db/transaction";
import { isUuid } from "../db/ids";

// PostgreSQL: tabla inventory_items (existencias actuales por producto y bodega).
//
// Las operaciones que pueden quedarse sin stock son UPDATE condicionales atómicos:
// la condición y el cambio ocurren en una sola sentencia, así dos peticiones
// simultáneas nunca pueden reservar (o despachar) la misma unidad dos veces.
// Devuelven false si la condición no se cumplió; el servicio decide el mensaje.

type ItemKey = { productId: string; warehouseId: string };

const key = ({ productId, warehouseId }: ItemKey) => ({
  productId_warehouseId: { productId, warehouseId },
});

export const InventoryRepository = {
  async findItem(productId: string, warehouseId: string): Promise<InventoryItem | undefined> {
    if (!isUuid(warehouseId)) return undefined;
    const row = await db().inventoryItem.findUnique({ where: key({ productId, warehouseId }) });
    return row ?? undefined;
  },

  async findAllItems(): Promise<InventoryItem[]> {
    return db().inventoryItem.findMany({ orderBy: [{ productId: "asc" }, { warehouseId: "asc" }] });
  },

  // Suma unidades (ingreso de mercancía), creando el registro si no existe.
  // Prisma lo traduce a INSERT ... ON CONFLICT DO UPDATE: seguro ante ingresos simultáneos.
  async addQuantity(productId: string, warehouseId: string, quantity: number): Promise<InventoryItem> {
    return db().inventoryItem.upsert({
      where: key({ productId, warehouseId }),
      create: { productId, warehouseId, quantity },
      update: { quantity: { increment: quantity } },
    });
  },

  // Reserva solo si hay disponible suficiente (cantidad - reservada - dañada)
  async tryReserve(productId: string, warehouseId: string, quantity: number): Promise<boolean> {
    if (!isUuid(warehouseId)) return false;
    const updated = await db().$executeRaw`
      UPDATE inventory_items
         SET reserved_quantity = reserved_quantity + ${quantity}
       WHERE product_id = ${productId}
         AND warehouse_id = ${warehouseId}::uuid
         AND quantity - reserved_quantity - damaged_quantity >= ${quantity}`;
    return updated === 1;
  },

  // Despacha unidades previamente reservadas: salen del stock y de la reserva
  async tryConfirmOutbound(productId: string, warehouseId: string, quantity: number): Promise<boolean> {
    if (!isUuid(warehouseId)) return false;
    const updated = await db().$executeRaw`
      UPDATE inventory_items
         SET quantity = quantity - ${quantity},
             reserved_quantity = reserved_quantity - ${quantity}
       WHERE product_id = ${productId}
         AND warehouse_id = ${warehouseId}::uuid
         AND reserved_quantity >= ${quantity}`;
    return updated === 1;
  },

  // Marca unidades como dañadas solo si hay suficientes sin dañar
  async tryMarkDamaged(productId: string, warehouseId: string, quantity: number): Promise<boolean> {
    if (!isUuid(warehouseId)) return false;
    const updated = await db().$executeRaw`
      UPDATE inventory_items
         SET damaged_quantity = damaged_quantity + ${quantity}
       WHERE product_id = ${productId}
         AND warehouse_id = ${warehouseId}::uuid
         AND quantity - damaged_quantity >= ${quantity}`;
    return updated === 1;
  },

  // Devolución: las unidades vuelven al stock (el registro ya debe existir)
  async addReturnedQuantity(productId: string, warehouseId: string, quantity: number): Promise<boolean> {
    if (!isUuid(warehouseId)) return false;
    const result = await db().inventoryItem.updateMany({
      where: { productId, warehouseId },
      data: { quantity: { increment: quantity } },
    });
    return result.count === 1;
  },
};
