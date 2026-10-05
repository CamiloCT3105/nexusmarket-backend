import { Product } from "../models/Product";

const products: Product[] = [];

export const ProductRepository = {
  findAll(): Product[] {
    return products;
  },

  findById(id: string): Product | undefined {
    return products.find((product) => product.id === id);
  },

  findBySellerId(sellerId: string): Product[] {
    return products.filter((product) => product.sellerId === sellerId);
  },

  create(product: Product): Product {
    products.push(product);
    return product;
  },

  update(id: string, updatedFields: Partial<Product>): Product | undefined {
    const product = this.findById(id);
    if (!product) return undefined;

    Object.assign(product, updatedFields);
    return product;
  },
};