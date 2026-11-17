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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

// Precio positivo con máximo dos decimales (centavos)
function assertValidPrice(price: unknown): asserts price is number {
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    throw new ValidationError("El precio del producto debe ser mayor a cero.");
  }
  if (Number(price.toFixed(2)) !== price) {
    throw new ValidationError("El precio admite como máximo dos decimales.");
  }
}

export const ProductService = {
  async createProduct(input: CreateProductInput): Promise<Product> {
    if (!isNonEmptyString(input.name)) {
      throw new ValidationError("El nombre del producto es obligatorio.");
    }
    if (input.description !== undefined && typeof input.description !== "string") {
      throw new ValidationError("La descripción debe ser texto.");
    }
    assertValidPrice(input.price);
    if (!Object.values(ProductType).includes(input.type)) {
      throw new ValidationError(
        `Tipo de producto inválido. Valores permitidos: ${Object.values(ProductType).join(", ")}.`
      );
    }

    // Validamos que el vendedor exista antes de crear el producto
    await SellerService.getSellerByUserId(input.sellerId);

    const newProduct: Product = {
      id: randomUUID(),
      sellerId: input.sellerId,
      name: input.name.trim(),
      description: input.description ?? "",
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
    if (!isNonEmptyString(variantName) || !isNonEmptyString(variantValue)) {
      throw new ValidationError("La variante necesita nombre y valor (por ejemplo, Color: Rojo).");
    }

    const newVariant: Variant = {
      id: randomUUID(),
      name: variantName.trim(),
      value: variantValue.trim(),
    };

    const updated = await ProductRepository.addVariant(productId, newVariant);
    if (!updated) {
      throw new NotFoundError("Producto no encontrado.");
    }
    return updated;
  },

  async changeStatus(productId: string, newStatus: ProductStatus): Promise<Product> {
    if (!Object.values(ProductStatus).includes(newStatus)) {
      throw new ValidationError(
        `Estado de producto inválido. Valores permitidos: ${Object.values(ProductStatus).join(", ")}.`
      );
    }
    const updated = await ProductRepository.updateStatus(productId, newStatus);
    if (!updated) {
      throw new NotFoundError("Producto no encontrado.");
    }
    return updated;
  },
};
