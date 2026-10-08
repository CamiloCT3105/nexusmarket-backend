import { Cart, CartItem } from "../models/Cart";
import { CartRepository } from "../repositories/CartRepository";
import { BuyerService } from "./BuyerService";
import { ProductService } from "./ProductService";
import { ProductStatus } from "../models/Product";

export const CartService = {
  // Obtiene el carrito del comprador, o crea uno vacío si no existe
  getOrCreateCart(buyerId: string): Cart {
    BuyerService.getBuyerByUserId(buyerId); // valida que el comprador exista

    let cart = CartRepository.findByBuyerId(buyerId);
    if (!cart) {
      cart = CartRepository.create({ buyerId, items: [] });
    }
    return cart;
  },

  addItem(buyerId: string, productId: string, quantity: number): Cart {
    if (quantity <= 0) {
      throw new Error("La cantidad debe ser mayor a cero.");
    }

    const product = ProductService.getProductById(productId);
    if (product.status !== ProductStatus.PUBLISHED) {
      throw new Error("Solo se pueden agregar al carrito productos publicados.");
    }

    const cart = this.getOrCreateCart(buyerId);
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

    return CartRepository.update(buyerId, { items: updatedItems })!;
  },

  removeItem(buyerId: string, productId: string): Cart {
    const cart = this.getOrCreateCart(buyerId);
    const updatedItems = cart.items.filter((item) => item.productId !== productId);
    return CartRepository.update(buyerId, { items: updatedItems })!;
  },

  updateQuantity(buyerId: string, productId: string, quantity: number): Cart {
    if (quantity <= 0) {
      throw new Error("La cantidad debe ser mayor a cero. Usa removeItem para eliminar el producto.");
    }

    const cart = this.getOrCreateCart(buyerId);
    const itemExists = cart.items.some((item) => item.productId === productId);
    if (!itemExists) {
      throw new Error("El producto no está en el carrito.");
    }

    const updatedItems = cart.items.map((item) =>
      item.productId === productId ? { ...item, quantity } : item
    );

    return CartRepository.update(buyerId, { items: updatedItems })!;
  },
};