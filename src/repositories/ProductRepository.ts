import { Product } from "../models/Product";
import { clone } from "./clone";

const products: Product[] = [];

export const ProductRepository = {
  async findAll(): Promise<Product[]> {
    return clone(products);
  },

  async findById(id: string): Promise<Product | undefined> {
    const product = products.find((p) => p.id === id);
    return product && clone(product);
  },

  async findBySellerId(sellerId: string): Promise<Product[]> {
    return clone(products.filter((p) => p.sellerId === sellerId));
  },

  async create(product: Product): Promise<Product> {
    products.push(clone(product));
    return clone(product);
  },

  async update(id: string, updatedFields: Partial<Product>): Promise<Product | undefined> {
    const product = products.find((p) => p.id === id);
    if (!product) return undefined;

    Object.assign(product, clone(updatedFields));
    return clone(product);
  },
};
