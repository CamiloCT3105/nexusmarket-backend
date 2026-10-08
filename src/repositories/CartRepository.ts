import { Cart } from "../models/Cart";

const carts: Cart[] = [];

export const CartRepository = {
  findByBuyerId(buyerId: string): Cart | undefined {
    return carts.find((cart) => cart.buyerId === buyerId);
  },

  create(cart: Cart): Cart {
    carts.push(cart);
    return cart;
  },

  update(buyerId: string, updatedFields: Partial<Cart>): Cart | undefined {
    const cart = this.findByBuyerId(buyerId);
    if (!cart) return undefined;

    Object.assign(cart, updatedFields);
    return cart;
  },

  clear(buyerId: string): void {
    const cart = this.findByBuyerId(buyerId);
    if (cart) {
      cart.items = [];
    }
  },
};