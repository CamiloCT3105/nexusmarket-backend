import { Schema, Types, model } from "mongoose";

// Colecciones de MongoDB. Son detalles de persistencia: los servicios nunca las usan
// directamente, solo a través de los repositorios (que devuelven los modelos de dominio).
//
// Los _id son los mismos UUID (texto) que genera la aplicación, no ObjectId: así las
// columnas product_id de PostgreSQL apuntan a documentos de aquí sin traducción.

// ─── Catálogo de productos ─────────────────────────────────────────────────────

export interface ProductDocument {
  _id: string;
  sellerId: string;
  name: string;
  description: string;
  price: Types.Decimal128; // dinero exacto, igual que DECIMAL en PostgreSQL
  type: string;
  variants: Array<{ id: string; name: string; value: string }>;
  status: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<ProductDocument>(
  {
    _id: { type: String, required: true },
    sellerId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    imageUrl: { type: String }, // opcional: los productos anteriores no la tienen
    price: { type: Schema.Types.Decimal128, required: true },
    type: { type: String, required: true },
    // Flexible a propósito: cada producto puede tener variantes distintas (color, talla, formato...)
    variants: [
      {
        _id: false,
        id: { type: String, required: true },
        name: { type: String, required: true },
        value: { type: String, required: true },
      },
    ],
    status: { type: String, required: true },
  },
  { timestamps: true, versionKey: false }
);
productSchema.index({ sellerId: 1 });
productSchema.index({ status: 1 });

export const ProductModel = model<ProductDocument>("Product", productSchema, "products");

// ─── Carritos ──────────────────────────────────────────────────────────────────

// Un documento por comprador (_id = buyerId). Escritura frecuente y vida corta.
export const CART_TTL_DAYS = 30;

export interface CartDocument {
  _id: string;
  items: Array<{ productId: string; quantity: number }>;
  createdAt: Date;
  updatedAt: Date;
}

const cartSchema = new Schema<CartDocument>(
  {
    _id: { type: String, required: true },
    items: [
      {
        _id: false,
        productId: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
  },
  { timestamps: true, versionKey: false }
);
// Índice TTL: MongoDB borra solo los carritos sin cambios durante CART_TTL_DAYS días
cartSchema.index({ updatedAt: 1 }, { expireAfterSeconds: CART_TTL_DAYS * 24 * 60 * 60 });

export const CartModel = model<CartDocument>("Cart", cartSchema, "carts");

// ─── Bitácora de movimientos de inventario ─────────────────────────────────────

// Solo se agregan documentos, nunca se modifican.
export interface InventoryMovementDocument {
  _id: string;
  productId: string;
  warehouseId: string;
  type: string;
  quantity: number;
  createdAt: Date;
}

const inventoryMovementSchema = new Schema<InventoryMovementDocument>(
  {
    _id: { type: String, required: true },
    productId: { type: String, required: true },
    warehouseId: { type: String, required: true },
    type: { type: String, required: true },
    quantity: { type: Number, required: true },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false }
);
inventoryMovementSchema.index({ productId: 1, createdAt: 1 });

export const InventoryMovementModel = model<InventoryMovementDocument>(
  "InventoryMovement",
  inventoryMovementSchema,
  "inventory_movements"
);
