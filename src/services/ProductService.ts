import { randomUUID } from "crypto";
import { Product, ProductType, ProductStatus, Variant } from "../models/Product";
import { ProductRepository } from "../repositories/ProductRepository";
import { SellerService } from "./SellerService";
import { NotFoundError, ValidationError } from "../errors/AppError";

type CreateProductInput = {
  sellerId: string;
  name: string;
  description: string;
  price: number;
  type: ProductType;
};

export const ProductService = {
  async createProduct(input: CreateProductInput): Promise<Product> {
    // Validamos que el vendedor exista antes de crear el producto
    await SellerService.getSellerByUserId(input.sellerId);

    if (input.price <= 0) {
      throw new ValidationError("El precio del producto debe ser mayor a cero.");
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

  async getProductById(id: string): Promise<Product> {
    const product = await ProductRepository.findById(id);
    if (!product) {
      throw new NotFoundError("Producto no encontrado.");
    }
    return product;
  },

  async getProductsBySeller(sellerId: string): Promise<Product[]> {
    return ProductRepository.findBySellerId(sellerId);
  },

  async listProducts(): Promise<Product[]> {
    return ProductRepository.findAll();
  },

  async addVariant(productId: string, variantName: string, variantValue: string): Promise<Product> {
    const product = await this.getProductById(productId);

    const newVariant: Variant = {
      id: randomUUID(),
      name: variantName,
      value: variantValue,
    };

    const updatedVariants = [...product.variants, newVariant];
    const updated = await ProductRepository.update(productId, { variants: updatedVariants });
    return updated!;
  },

  async changeStatus(productId: string, newStatus: ProductStatus): Promise<Product> {
    await this.getProductById(productId); // valida existencia
    const updated = await ProductRepository.update(productId, { status: newStatus });
    return updated!;
  },
};
