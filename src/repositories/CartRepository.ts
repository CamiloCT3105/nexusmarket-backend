import { Cart } from "../models/Cart";
import { clone } from "./clone";

const carts: Cart[] = [];

export const CartRepository = {
  async findByBuyerId(buyerId: string): Promise<Cart | undefined> {
    const cart = carts.find((c) => c.buyerId === buyerId);
    return cart && clone(cart);
  },

  async create(cart: Cart): Promise<Cart> {
    carts.push(clone(cart));
    return clone(cart);
  },

  async update(buyerId: string, updatedFields: Partial<Cart>): Promise<Cart | undefined> {
    const cart = carts.find((c) => c.buyerId === buyerId);
    if (!cart) return undefined;

    Object.assign(cart, clone(updatedFields));
    return clone(cart);
  },

  async clear(buyerId: string): Promise<void> {
    const cart = carts.find((c) => c.buyerId === buyerId);
    if (cart) {
      cart.items = [];
    }
  },
};
