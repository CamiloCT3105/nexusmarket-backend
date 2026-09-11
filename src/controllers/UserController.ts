import { Request, Response } from "express";
import { UserService } from "../services/UserService";
import { UserRole, UserStatus } from "../models/User";

export const UserController = {
  create(req: Request, res: Response): void {
    try {
      const { fullName, email, role } = req.body;
      const newUser = UserService.createUser({ fullName, email, role });
      res.status(201).json(newUser);
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
      const user = UserService.getUserById(id);
      res.status(200).json(user);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  },

  changeStatus(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      if (typeof id !== "string") {
        res.status(400).json({ message: "El parámetro 'id' es requerido." });
        return;
      }
      const { status } = req.body as { status: UserStatus };
      const updated = UserService.changeStatus(id, status);
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },

  assignRole(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      if (typeof id !== "string") {
        res.status(400).json({ message: "El parámetro 'id' es requerido." });
        return;
      }
      const { role } = req.body as { role: UserRole };
      const updated = UserService.assignRole(id, role);
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },
};