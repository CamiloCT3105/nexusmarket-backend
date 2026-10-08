import { Request, Response } from "express";
import { AuthService } from "../services/AuthService";
import { UserService } from "../services/UserService";
import { getAuthUser } from "../middlewares/authenticate";

export const AuthController = {
  register(req: Request, res: Response): void {
    try {
      const { fullName, email, password } = req.body as {
        fullName: string;
        email: string;
        password: string;
      };
      const user = AuthService.registerBuyerAccount({ fullName, email, password });
      res.status(201).json(user);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },

  login(req: Request, res: Response): void {
    try {
      const { email, password } = req.body as { email: string; password: string };
      const result = AuthService.login(email, password);
      res.status(200).json(result);
    } catch (error) {
      res.status(401).json({ message: (error as Error).message });
    }
  },

  me(_req: Request, res: Response): void {
    try {
      const authUser = getAuthUser(res);
      const user = UserService.getUserById(authUser.id);
      res.status(200).json(user);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  },
};