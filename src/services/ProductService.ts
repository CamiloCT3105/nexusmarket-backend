import { randomUUID } from "crypto";
import { Product, ProductType, ProductStatus, Variant } from "../models/Product";
import { ProductFilter, ProductRepository, ProductSort } from "../repositories/ProductRepository";
import { SellerService } from "./SellerService";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors/AppError";
import { AuthUser } from "../models/AuthUser";
import { UserRole } from "../models/User";
import { Page, PageRequest } from "../utils/pagination";

type CreateProductInput = {
  sellerId: string;
  name: string;
  description: string;
  price: number;
  type: ProductType;
  imageUrl?: unknown;
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

const MAX_IMAGE_URL_LENGTH = 2048;

// Foto del producto (RN-68): una URL https pública. No se guardan archivos en el servidor (el disco de
// Render gratuito se borra en cada despliegue); la imagen vive en un servicio externo.
// Devuelve la URL normalizada, o null si viene vacía (sin foto).
function normalizeImageUrl(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new ValidationError("La URL de la imagen debe ser texto.");
  }
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (trimmed.length > MAX_IMAGE_URL_LENGTH) {
    throw new ValidationError(`La URL de la imagen admite como máximo ${MAX_IMAGE_URL_LENGTH} caracteres.`);
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ValidationError("La URL de la imagen no es válida.");
  }
  // Solo https: el frontend se sirve por https y el navegador bloquearía imágenes http (contenido mixto)
  if (url.protocol !== "https:") {
    throw new ValidationError("La URL de la imagen debe empezar por https://.");
  }
  if (url.username !== "" || url.password !== "") {
    throw new ValidationError("La URL de la imagen no puede incluir usuario ni contraseña.");
  }
  return url.toString();
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

    const imageUrl = normalizeImageUrl(input.imageUrl);

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
      ...(imageUrl ? { imageUrl } : {}),
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

  // Catálogo paginado. Lo que se ve depende de quién consulta:
  // - Comprador y operador logístico: solo productos publicados (catálogo público).
  // - Vendedor: los publicados y los suyos en cualquier estado.
  // - Administrador y supervisor: todos.
  async searchCatalog(
    viewer: AuthUser,
    filter: Omit<ProductFilter, "onlyPublished" | "publishedOrOwnedBy">,
    sort: ProductSort,
    request: PageRequest
  ): Promise<Page<Product>> {
    if (filter.minPrice !== undefined && filter.maxPrice !== undefined && filter.minPrice > filter.maxPrice) {
      throw new ValidationError("El parámetro 'minPrice' no puede ser mayor que 'maxPrice'.");
    }

    switch (viewer.role) {
      case UserRole.ADMIN:
      case UserRole.SUPERVISOR:
        return ProductRepository.findPage(filter, sort, request);
      case UserRole.SELLER:
        return ProductRepository.findPage({ ...filter, publishedOrOwnedBy: viewer.id }, sort, request);
      default:
        if (filter.status && filter.status !== ProductStatus.PUBLISHED) {
          throw new ForbiddenError("Solo puedes consultar productos publicados.");
        }
        return ProductRepository.findPage({ ...filter, onlyPublished: true }, sort, request);
    }
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

  // Cambia la foto; una URL vacía o null la quita
  async updateImage(productId: string, imageUrl: unknown): Promise<Product> {
    if (imageUrl === undefined) {
      throw new ValidationError("Envía 'imageUrl' (una URL https, o null para quitar la imagen).");
    }
    const updated = await ProductRepository.updateImage(productId, normalizeImageUrl(imageUrl));
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
