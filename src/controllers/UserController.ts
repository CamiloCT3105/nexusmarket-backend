import { Request, Response } from "express";
import { UserService } from "../services/UserService";
import { UserRole, UserStatus } from "../models/User";
import { AuthService } from "../services/AuthService";
import { ValidationError } from "../errors/AppError";
import { requireParam } from "../utils/params";

export const UserController = {
  async create(req: Request, res: Response): Promise<void> {
    const { fullName, email, password, role } = req.body as {
      fullName: string;
      email: string;
      password: string;
      role: UserRole;
    };

    if (!Object.values(UserRole).includes(role)) {
      throw new ValidationError("Rol inválido.");
    }

    const newUser = await AuthService.registerUser({ fullName, email, password, role });
    res.status(201).json(newUser);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const user = await UserService.getUserById(requireParam(req, "id"));
    res.status(200).json(user);
  },

  async changeStatus(req: Request, res: Response): Promise<void> {
    const { status } = req.body as { status: UserStatus };
    const updated = await UserService.changeStatus(requireParam(req, "id"), status);
    res.status(200).json(updated);
  },

  async assignRole(req: Request, res: Response): Promise<void> {
    const { role } = req.body as { role: UserRole };
    const updated = await UserService.assignRole(requireParam(req, "id"), role);
    res.status(200).json(updated);
  },
};
