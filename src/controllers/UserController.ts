import { Request, Response } from "express";
import { UserService } from "../services/UserService";
import { UserRole, UserStatus } from "../models/User";
import { AuthService } from "../services/AuthService";
import { requireParam } from "../utils/params";
import { optionalEnum, optionalString, pageRequest } from "../utils/query";

export const UserController = {
  async create(req: Request, res: Response): Promise<void> {
    const { fullName, email, documentNumber, password, role } = req.body as {
      fullName: string;
      email: string;
      documentNumber: string;
      password: string;
      role: UserRole;
    };

    const newUser = await AuthService.registerUser({ fullName, email, documentNumber, password, role });
    res.status(201).json(newUser);
  },

  // GET /api/users?role=&status=&search=&page=&pageSize=
  async list(req: Request, res: Response): Promise<void> {
    const page = await UserService.listUsersPage(
      {
        role: optionalEnum(req, "role", Object.values(UserRole)),
        status: optionalEnum(req, "status", Object.values(UserStatus)),
        search: optionalString(req, "search"),
      },
      pageRequest(req)
    );
    res.status(200).json(page);
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
