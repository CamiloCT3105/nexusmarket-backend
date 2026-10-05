export enum WarehouseType {
  MARKETPLACE = "MARKETPLACE",
  SELLER = "SELLER",
}

export interface Warehouse {
  id: string;
  type: WarehouseType;
  sellerId?: string; // solo aplica cuando type === SELLER
  location: string;
}