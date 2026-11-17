import { Order } from "../models/Order";
import { clone } from "./clone";

const orders: Order[] = [];

export const OrderRepository = {
  async findById(id: string): Promise<Order | undefined> {
    const order = orders.find((o) => o.id === id);
    return order && clone(order);
  },

  async findByBuyerId(buyerId: string): Promise<Order[]> {
    return clone(orders.filter((o) => o.buyerId === buyerId));
  },

  async findAll(): Promise<Order[]> {
    return clone(orders);
  },

  async create(order: Order): Promise<Order> {
    orders.push(clone(order));
    return clone(order);
  },

  async update(id: string, updatedFields: Partial<Order>): Promise<Order | undefined> {
    const order = orders.find((o) => o.id === id);
    if (!order) return undefined;

    Object.assign(order, clone(updatedFields));
    return clone(order);
  },
};
