import { Warehouse } from "../models/Warehouse";
import { clone } from "./clone";

const warehouses: Warehouse[] = [];

export const WarehouseRepository = {
  async findAll(): Promise<Warehouse[]> {
    return clone(warehouses);
  },

  async findById(id: string): Promise<Warehouse | undefined> {
    const warehouse = warehouses.find((w) => w.id === id);
    return warehouse && clone(warehouse);
  },

  async findBySellerId(sellerId: string): Promise<Warehouse[]> {
    return clone(warehouses.filter((w) => w.sellerId === sellerId));
  },

  async create(warehouse: Warehouse): Promise<Warehouse> {
    warehouses.push(clone(warehouse));
    return clone(warehouse);
  },

  async update(id: string, updatedFields: Partial<Warehouse>): Promise<Warehouse | undefined> {
    const warehouse = warehouses.find((w) => w.id === id);
    if (!warehouse) return undefined;

    Object.assign(warehouse, clone(updatedFields));
    return clone(warehouse);
  },
};
