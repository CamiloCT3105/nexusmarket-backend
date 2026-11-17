import { Request, Response } from "express";
import { ProductService } from "../services/ProductService";
import { Product, ProductType, ProductStatus } from "../models/Product";
import { AuthUser } from "../models/AuthUser";
import { UserRole } from "../models/User";
import { getAuthUser } from "../middlewares/authenticate";
import { ForbiddenError } from "../errors/AppError";
import { requireParam } from "../utils/params";

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

export const ProductController = {
  async create(req: Request, res: Response): Promise<void> {
    const authUser = getAuthUser(res);
    const { name, description, price, type } = req.body as {
      name: string;
      description: string;
      price: number;
      type: ProductType;
    };
    // El vendedor dueño es SIEMPRE quien está autenticado, nunca lo que diga el body
    const product = await ProductService.createProduct({
      sellerId: authUser.id,
      name,
      description,
      price,
      type,
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

  async changeStatus(req: Request, res: Response): Promise<void> {
    const product = await getManageableProduct(req, res);
    const { status } = req.body as { status: ProductStatus };
    const updated = await ProductService.changeStatus(product.id, status);
    res.status(200).json(updated);
  },
};
