export enum MovementType {
  INBOUND = "INBOUND",     // Ingreso de mercancía
  RESERVE = "RESERVE",     // Reserva (ej: al agregar al carrito o confirmar pedido)
  OUTBOUND = "OUTBOUND",   // Salida (despacho confirmado)
  ADJUSTMENT = "ADJUSTMENT", // Ajuste manual (ej: producto dañado)
  RETURN = "RETURN",       // Devolución de un pedido
}

export interface InventoryItem {
  productId: string;
  warehouseId: string;
  quantity: number;
  reservedQuantity: number;
  damagedQuantity: number;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  warehouseId: string;
  type: MovementType;
  quantity: number;
  createdAt: Date;
}