import { Request, Response } from "express";
import { AuthService } from "../services/AuthService";
import { UserService } from "../services/UserService";
import { getAuthUser } from "../middlewares/authenticate";

// Los errores no se capturan aquí: Express 5 los envía al middleware central (errorHandler)
export const AuthController = {
  async register(req: Request, res: Response): Promise<void> {
    const { fullName, email, documentNumber, password } = req.body as {
      fullName: string;
      email: string;
      documentNumber: string;
      password: string;
    };
    const user = await AuthService.registerBuyerAccount({ fullName, email, documentNumber, password });
    res.status(201).json(user);
  },

  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body as { email: string; password: string };
    const result = await AuthService.login(email, password);
    res.status(200).json(result);
  },

  async me(_req: Request, res: Response): Promise<void> {
    const authUser = getAuthUser(res);
    const user = await UserService.getUserById(authUser.id);
    res.status(200).json(user);
  },
};
