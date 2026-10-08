import { Order } from "../models/Order";

const orders: Order[] = [];

export const OrderRepository = {
  findById(id: string): Order | undefined {
    return orders.find((order) => order.id === id);
  },

  findByBuyerId(buyerId: string): Order[] {
    return orders.filter((order) => order.buyerId === buyerId);
  },

  create(order: Order): Order {
    orders.push(order);
    return order;
  },

  update(id: string, updatedFields: Partial<Order>): Order | undefined {
    const order = this.findById(id);
    if (!order) return undefined;

    Object.assign(order, updatedFields);
    return order;
  },
};