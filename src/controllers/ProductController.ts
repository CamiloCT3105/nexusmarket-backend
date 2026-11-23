import { Request, Response } from "express";
import { ProductService } from "../services/ProductService";
import { Product, ProductType, ProductStatus } from "../models/Product";
import { AuthUser } from "../models/AuthUser";
import { UserRole } from "../models/User";
import { getAuthUser } from "../middlewares/authenticate";
import { ForbiddenError } from "../errors/AppError";
import { requireParam } from "../utils/params";
import { optionalEnum, optionalNumber, optionalString, pageRequest } from "../utils/query";
import { ProductSort } from "../repositories/ProductRepository";

// ADMIN puede gestionar cualquier producto; un SELLER solo los suyos
function canManageProduct(authUser: AuthUser, product: Product): boolean {
  return authUser.role === UserRole.ADMIN || product.sellerId === authUser.id;
}

async function getManageableProduct(req: Request, res: Response): Promise<Product> {
  const product = await ProductService.getProductById(requireParam(req, "id"));
  if (!canManageProduct(getAuthUser(res), product)) {
    throw new ForbiddenError("Solo puedes modificar tus propios productos.");
  }
  return product;
}

const PRODUCT_SORTS: ProductSort[] = ["newest", "price_asc", "price_desc", "name_asc"];

export const ProductController = {
  // GET /api/products?search=&type=&sellerId=&minPrice=&maxPrice=&status=&sort=&page=&pageSize=
  async list(req: Request, res: Response): Promise<void> {
    const page = await ProductService.searchCatalog(
      getAuthUser(res),
      {
        search: optionalString(req, "search"),
        type: optionalEnum(req, "type", Object.values(ProductType)),
        sellerId: optionalString(req, "sellerId"),
        minPrice: optionalNumber(req, "minPrice", { min: 0 }),
        maxPrice: optionalNumber(req, "maxPrice", { min: 0 }),
        status: optionalEnum(req, "status", Object.values(ProductStatus)),
      },
      optionalEnum(req, "sort", PRODUCT_SORTS) ?? "newest",
      pageRequest(req)
    );
    res.status(200).json(page);
  },

  async create(req: Request, res: Response): Promise<void> {
    const authUser = getAuthUser(res);
    const { name, description, price, type, imageUrl } = req.body as {
      name: string;
      description: string;
      price: number;
      type: ProductType;
      imageUrl?: unknown;
    };
    // El vendedor dueño es SIEMPRE quien está autenticado, nunca lo que diga el body
    const product = await ProductService.createProduct({
      sellerId: authUser.id,
      name,
      description,
      price,
      type,
      imageUrl,
    });
    res.status(201).json(product);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const product = await ProductService.getProductById(requireParam(req, "id"));
    res.status(200).json(product);
  },

  async getBySeller(req: Request, res: Response): Promise<void> {
    const products = await ProductService.getProductsBySeller(requireParam(req, "sellerId"));
    res.status(200).json(products);
  },

  async addVariant(req: Request, res: Response): Promise<void> {
    const product = await getManageableProduct(req, res);
    const { name, value } = req.body as { name: string; value: string };
    const updated = await ProductService.addVariant(product.id, name, value);
    res.status(200).json(updated);
  },

  async updateImage(req: Request, res: Response): Promise<void> {
    const product = await getManageableProduct(req, res);
    const { imageUrl } = (req.body ?? {}) as { imageUrl?: unknown };
    const updated = await ProductService.updateImage(product.id, imageUrl);
    res.status(200).json(updated);
  },

  async changeStatus(req: Request, res: Response): Promise<void> {
    const product = await getManageableProduct(req, res);
    const { status } = req.body as { status: ProductStatus };
    const updated = await ProductService.changeStatus(product.id, status);
    res.status(200).json(updated);
  },
};
