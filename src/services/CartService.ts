import { Cart } from "../models/Cart";
import { CartRepository } from "../repositories/CartRepository";
import { BuyerService } from "./BuyerService";
import { ProductService } from "./ProductService";
import { ProductStatus } from "../models/Product";
import { ValidationError } from "../errors/AppError";

function assertValidQuantity(quantity: unknown, hint = ""): asserts quantity is number {
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) {
    throw new ValidationError(`La cantidad debe ser un número entero mayor a cero.${hint}`);
  }
}

export const CartService = {
  // Obtiene el carrito del comprador, o crea uno vacío si no existe
  async getOrCreateCart(buyerId: string): Promise<Cart> {
    await BuyerService.getBuyerByUserId(buyerId); // valida que el comprador exista
    return CartRepository.getOrCreate(buyerId);
  },

  async addItem(buyerId: string, productId: string, quantity: number): Promise<Cart> {
    assertValidQuantity(quantity);

    const product = await ProductService.getProductById(productId);
    if (product.status !== ProductStatus.PUBLISHED) {
      throw new ValidationError("Solo se pueden agregar al carrito productos publicados.");
    }

    await this.getOrCreateCart(buyerId);
    // Si el producto ya está, suma la cantidad en la misma línea; si no, agrega una línea nueva
    await CartRepository.addItem(buyerId, productId, quantity);
    return CartRepository.getOrCreate(buyerId);
  },

  async removeItem(buyerId: string, productId: string): Promise<Cart> {
    await this.getOrCreateCart(buyerId);
    await CartRepository.removeItem(buyerId, productId);
    return CartRepository.getOrCreate(buyerId);
  },

  async updateQuantity(buyerId: string, productId: string, quantity: number): Promise<Cart> {
    assertValidQuantity(quantity, " Usa removeItem para eliminar el producto.");

    await this.getOrCreateCart(buyerId);
    if (!(await CartRepository.setQuantity(buyerId, productId, quantity))) {
      throw new ValidationError("El producto no está en el carrito.");
    }
    return CartRepository.getOrCreate(buyerId);
  },

  async clearCart(buyerId: string): Promise<void> {
    await CartRepository.clear(buyerId);
  },
};
