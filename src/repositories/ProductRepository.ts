import { QueryFilter, Types } from "mongoose";
import { Product, ProductStatus, ProductType, Variant } from "../models/Product";
import { ProductDocument, ProductModel } from "../db/mongoModels";
import { Page, PageRequest, skipTake, toPage } from "../utils/pagination";
import { escapeRegex } from "../utils/query";

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

export type ProductSort = "newest" | "price_asc" | "price_desc" | "name_asc";

export type ProductFilter = {
  search?: string | undefined; // parte del nombre, sin distinguir mayúsculas
  type?: ProductType | undefined;
  sellerId?: string | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  status?: ProductStatus | undefined;
  // Visibilidad según quién consulta (la decide ProductService):
  onlyPublished?: boolean; // comprador, operador logístico
  publishedOrOwnedBy?: string | undefined; // vendedor: publicados + los suyos en cualquier estado
};

const SORTS: Record<ProductSort, Record<string, 1 | -1>> = {
  newest: { createdAt: -1, _id: 1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
  name_asc: { name: 1, _id: 1 },
};

function toQuery(filter: ProductFilter): QueryFilter<ProductDocument> {
  const conditions: QueryFilter<ProductDocument>[] = [];
  if (filter.search) conditions.push({ name: { $regex: escapeRegex(filter.search), $options: "i" } });
  if (filter.type) conditions.push({ type: filter.type });
  if (filter.sellerId) conditions.push({ sellerId: filter.sellerId });
  if (filter.status) conditions.push({ status: filter.status });
  if (filter.minPrice !== undefined) conditions.push({ price: { $gte: money(filter.minPrice) } });
  if (filter.maxPrice !== undefined) conditions.push({ price: { $lte: money(filter.maxPrice) } });
  if (filter.onlyPublished) conditions.push({ status: ProductStatus.PUBLISHED });
  if (filter.publishedOrOwnedBy) {
    conditions.push({ $or: [{ status: ProductStatus.PUBLISHED }, { sellerId: filter.publishedOrOwnedBy }] });
  }
  return conditions.length > 0 ? { $and: conditions } : {};
}

export const ProductRepository = {
  async findPage(filter: ProductFilter, sort: ProductSort, request: PageRequest): Promise<Page<Product>> {
    const query = toQuery(filter);
    const { skip, take } = skipTake(request);
    const [docs, total] = await Promise.all([
      ProductModel.find(query)
        .sort(SORTS[sort])
        // Orden alfabético en español: sin distinguir mayúsculas ni tildes
        .collation({ locale: "es", strength: 1 })
        .skip(skip)
        .limit(take)
        .lean<ProductDocument[]>(),
      ProductModel.countDocuments(query),
    ]);
    return toPage(docs.map(toProduct), total, request);
  },

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
