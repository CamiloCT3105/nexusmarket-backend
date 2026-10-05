import { randomUUID } from "crypto";
import { Product, ProductType, ProductStatus, Variant } from "../models/Product";
import { ProductRepository } from "../repositories/ProductRepository";
import { SellerService } from "./SellerService";

type CreateProductInput = {
  sellerId: string;
  name: string;
  description: string;
  price: number;
  type: ProductType;
};

export const ProductService = {
  createProduct(input: CreateProductInput): Product {
    // Ahora sí validamos que el vendedor exista antes de crear el producto
    SellerService.getSellerByUserId(input.sellerId);

    if (input.price <= 0) {
      throw new Error("El precio del producto debe ser mayor a cero.");
    }

    const newProduct: Product = {
      id: randomUUID(),
      sellerId: input.sellerId,
      name: input.name,
      description: input.description,
      price: input.price,
      type: input.type,
      variants: [],
      status: ProductStatus.PUBLISHED,
    };

    return ProductRepository.create(newProduct);
  },

  getProductById(id: string): Product {
    const product = ProductRepository.findById(id);
    if (!product) {
      throw new Error("Producto no encontrado.");
    }
    return product;
  },

  getProductsBySeller(sellerId: string): Product[] {
    return ProductRepository.findBySellerId(sellerId);
  },

  addVariant(productId: string, variantName: string, variantValue: string): Product {
    const product = this.getProductById(productId);

    const newVariant: Variant = {
      id: randomUUID(),
      name: variantName,
      value: variantValue,
    };

    const updatedVariants = [...product.variants, newVariant];
    const updated = ProductRepository.update(productId, { variants: updatedVariants });
    return updated!;
  },

  changeStatus(productId: string, newStatus: ProductStatus): Product {
    this.getProductById(productId); // valida existencia
    const updated = ProductRepository.update(productId, { status: newStatus });
    return updated!;
  },
};