import { Cart } from "../models/Cart";
import { CartDocument, CartModel } from "../db/mongoModels";

// MongoDB: colección carts, un documento por comprador (_id = buyerId).
// Cada operación es atómica en el servidor de MongoDB ($inc, $push, $set, $pull):
// dos peticiones simultáneas sobre el mismo carrito no se pisan entre sí.
// Los carritos sin cambios durante CART_TTL_DAYS días los borra MongoDB (índice TTL).

function toCart(doc: CartDocument): Cart {
  return {
    buyerId: doc._id,
    items: doc.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
  };
}

const isDuplicateKey = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;

export const CartRepository = {
  async findByBuyerId(buyerId: string): Promise<Cart | undefined> {
    const doc = await CartModel.findById(buyerId).lean<CartDocument>();
    return doc ? toCart(doc) : undefined;
  },

  // Devuelve el carrito, creándolo vacío si no existe (upsert: seguro ante dos primeras visitas simultáneas)
  async getOrCreate(buyerId: string): Promise<Cart> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const doc = await CartModel.findOneAndUpdate(
          { _id: buyerId },
          { $setOnInsert: { items: [] } },
          { upsert: true, new: true }
        ).lean<CartDocument>();
        return toCart(doc!);
      } catch (error) {
        // Dos upserts simultáneos: uno inserta y el otro choca con la llave; se reintenta y lo encuentra
        if (!isDuplicateKey(error) || attempt === 1) throw error;
      }
    }
    throw new Error("No se pudo crear el carrito.");
  },

  // Suma unidades si el producto ya está en el carrito; si no, agrega la línea.
  // Se reintenta si otra petición agregó la misma línea entre los dos pasos.
  async addItem(buyerId: string, productId: string, quantity: number): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const incremented = await CartModel.updateOne(
        { _id: buyerId, "items.productId": productId },
        { $inc: { "items.$.quantity": quantity } }
      );
      if (incremented.matchedCount === 1) return;

      const pushed = await CartModel.updateOne(
        { _id: buyerId, "items.productId": { $ne: productId } },
        { $push: { items: { productId, quantity } } }
      );
      if (pushed.matchedCount === 1) return;
    }
    throw new Error("No se pudo actualizar el carrito por modificaciones simultáneas.");
  },

  // Devuelve false si el producto no estaba en el carrito
  async setQuantity(buyerId: string, productId: string, quantity: number): Promise<boolean> {
    const result = await CartModel.updateOne(
      { _id: buyerId, "items.productId": productId },
      { $set: { "items.$.quantity": quantity } }
    );
    return result.matchedCount === 1;
  },

  async removeItem(buyerId: string, productId: string): Promise<void> {
    await CartModel.updateOne({ _id: buyerId }, { $pull: { items: { productId } } });
  },

  async clear(buyerId: string): Promise<void> {
    await CartModel.updateOne({ _id: buyerId }, { $set: { items: [] } });
  },
};
