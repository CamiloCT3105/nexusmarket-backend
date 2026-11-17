import { Types } from "mongoose";
import { Product, ProductStatus, ProductType, Variant } from "../models/Product";
import { ProductDocument, ProductModel } from "../db/mongoModels";

// MongoDB: colección products. Cada producto es un documento con sus variantes embebidas.

function toProduct(doc: ProductDocument): Product {
  return {
    id: doc._id,
    sellerId: doc.sellerId,
    name: doc.name,
    description: doc.description,
    price: Number(doc.price.toString()),
    type: doc.type as ProductType,
    variants: doc.variants.map((v): Variant => ({ id: v.id, name: v.name, value: v.value })),
    status: doc.status as ProductStatus,
  };
}

const money = (value: number) => Types.Decimal128.fromString(value.toFixed(2));

export const ProductRepository = {
  async findAll(): Promise<Product[]> {
    const docs = await ProductModel.find().sort({ createdAt: 1 }).lean<ProductDocument[]>();
    return docs.map(toProduct);
  },

  async findById(id: string): Promise<Product | undefined> {
    const doc = await ProductModel.findById(id).lean<ProductDocument>();
    return doc ? toProduct(doc) : undefined;
  },

  async findBySellerId(sellerId: string): Promise<Product[]> {
    const docs = await ProductModel.find({ sellerId }).sort({ createdAt: 1 }).lean<ProductDocument[]>();
    return docs.map(toProduct);
  },

  async create(product: Product): Promise<Product> {
    const doc = await ProductModel.create({
      _id: product.id,
      sellerId: product.sellerId,
      name: product.name,
      description: product.description,
      price: money(product.price),
      type: product.type,
      variants: product.variants,
      status: product.status,
    });
    return toProduct(doc.toObject());
  },

  // Agrega una variante con $push: atómico, no reescribe la lista completa
  async addVariant(id: string, variant: Variant): Promise<Product | undefined> {
    const doc = await ProductModel.findByIdAndUpdate(
      id,
      { $push: { variants: variant } },
      { new: true }
    ).lean<ProductDocument>();
    return doc ? toProduct(doc) : undefined;
  },

  async updateStatus(id: string, status: ProductStatus): Promise<Product | undefined> {
    const doc = await ProductModel.findByIdAndUpdate(id, { $set: { status } }, { new: true }).lean<ProductDocument>();
    return doc ? toProduct(doc) : undefined;
  },
};
