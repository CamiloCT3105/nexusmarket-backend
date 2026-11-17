import { Cart, CartItem } from "../models/Cart";
import { CartRepository } from "../repositories/CartRepository";
import { BuyerService } from "./BuyerService";
import { ProductService } from "./ProductService";
import { ProductStatus } from "../models/Product";
import { ValidationError } from "../errors/AppError";

export const CartService = {
  // Obtiene el carrito del comprador, o crea uno vacío si no existe
  async getOrCreateCart(buyerId: string): Promise<Cart> {
    await BuyerService.getBuyerByUserId(buyerId); // valida que el comprador exista

    const cart = await CartRepository.findByBuyerId(buyerId);
    return cart ?? CartRepository.create({ buyerId, items: [] });
  },

  async addItem(buyerId: string, productId: string, quantity: number): Promise<Cart> {
    if (quantity <= 0) {
      throw new ValidationError("La cantidad debe ser mayor a cero.");
    }

    const product = await ProductService.getProductById(productId);
    if (product.status !== ProductStatus.PUBLISHED) {
      throw new ValidationError("Solo se pueden agregar al carrito productos publicados.");
    }

    const cart = await this.getOrCreateCart(buyerId);
    const existingItem = cart.items.find((item) => item.productId === productId);

    let updatedItems: CartItem[];
    if (existingItem) {
      updatedItems = cart.items.map((item) =>
        item.productId === productId
          ? { ...item, quantity: item.quantity + quantity }
          : item
      );
    } else {
      updatedItems = [...cart.items, { productId, quantity }];
    }

    return (await CartRepository.update(buyerId, { items: updatedItems }))!;
  },

  async removeItem(buyerId: string, productId: string): Promise<Cart> {
    const cart = await this.getOrCreateCart(buyerId);
    const updatedItems = cart.items.filter((item) => item.productId !== productId);
    return (await CartRepository.update(buyerId, { items: updatedItems }))!;
  },

  async updateQuantity(buyerId: string, productId: string, quantity: number): Promise<Cart> {
    if (quantity <= 0) {
      throw new ValidationError(
        "La cantidad debe ser mayor a cero. Usa removeItem para eliminar el producto."
      );
    }

    const cart = await this.getOrCreateCart(buyerId);
    const itemExists = cart.items.some((item) => item.productId === productId);
    if (!itemExists) {
      throw new ValidationError("El producto no está en el carrito.");
    }

    const updatedItems = cart.items.map((item) =>
      item.productId === productId ? { ...item, quantity } : item
    );

    return (await CartRepository.update(buyerId, { items: updatedItems }))!;
  },

  async clearCart(buyerId: string): Promise<void> {
    await CartRepository.clear(buyerId);
  },
};
