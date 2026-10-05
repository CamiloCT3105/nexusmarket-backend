import { Warehouse } from "../models/Warehouse";

const warehouses: Warehouse[] = [];

export const WarehouseRepository = {
  findAll(): Warehouse[] {
    return warehouses;
  },

  findById(id: string): Warehouse | undefined {
    return warehouses.find((warehouse) => warehouse.id === id);
  },

  findBySellerId(sellerId: string): Warehouse[] {
    return warehouses.filter((warehouse) => warehouse.sellerId === sellerId);
  },

  create(warehouse: Warehouse): Warehouse {
    warehouses.push(warehouse);
    return warehouse;
  },
};