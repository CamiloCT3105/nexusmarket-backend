import { Request, Response } from "express";
import { ProductService } from "../services/ProductService";
import { Product, ProductType, ProductStatus } from "../models/Product";
import { AuthUser } from "../models/AuthUser";
import { UserRole } from "../models/User";
import { getAuthUser } from "../middlewares/authenticate";

// ADMIN puede gestionar cualquier producto; un SELLER solo los suyos
function canManageProduct(authUser: AuthUser, product: Product): boolean {
  return authUser.role === UserRole.ADMIN || product.sellerId === authUser.id;
}

export const ProductController = {
  create(req: Request, res: Response): void {
    try {
      const authUser = getAuthUser(res);
      const { name, description, price, type } = req.body as {
        name: string;
        description: string;
        price: number;
        type: ProductType;
      };
      // El vendedor dueño es SIEMPRE quien está autenticado, nunca lo que diga el body
      const product = ProductService.createProduct({
        sellerId: authUser.id,
        name,
        description,
        price,
        type,
      });
      res.status(201).json(product);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },

  getById(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      if (typeof id !== "string") {
        res.status(400).json({ message: "El parámetro 'id' es requerido." });
        return;
      }
      const product = ProductService.getProductById(id);
      res.status(200).json(product);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  },

  getBySeller(req: Request, res: Response): void {
    try {
      const { sellerId } = req.params;
      if (typeof sellerId !== "string") {
        res.status(400).json({ message: "El parámetro 'sellerId' es requerido." });
        return;
      }
      const products = ProductService.getProductsBySeller(sellerId);
      res.status(200).json(products);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },

  addVariant(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      if (typeof id !== "string") {
        res.status(400).json({ message: "El parámetro 'id' es requerido." });
        return;
      }

      const product = ProductService.getProductById(id);
      if (!canManageProduct(getAuthUser(res), product)) {
        res.status(403).json({ message: "Solo puedes modificar tus propios productos." });
        return;
      }

      const { name, value } = req.body as { name: string; value: string };
      const updated = ProductService.addVariant(id, name, value);
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },

  changeStatus(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      if (typeof id !== "string") {
        res.status(400).json({ message: "El parámetro 'id' es requerido." });
        return;
      }

      const product = ProductService.getProductById(id);
      if (!canManageProduct(getAuthUser(res), product)) {
        res.status(403).json({ message: "Solo puedes modificar tus propios productos." });
        return;
      }

      const { status } = req.body as { status: ProductStatus };
      const updated = ProductService.changeStatus(id, status);
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },
};