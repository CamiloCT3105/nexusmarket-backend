import { Request, Response } from "express";
import { RefundService } from "../services/RefundService";
import { ReturnService } from "../services/ReturnService";
import { OrderService } from "../services/OrderService";
import { Refund, RefundStatus } from "../models/Refund";
import { AuthUser } from "../models/AuthUser";
import { UserRole } from "../models/User";
import { getAuthUser } from "../middlewares/authenticate";

// Un BUYER solo ve sus reembolsos. Para saberlo hay que seguir la cadena:
// reembolso -> devolución -> pedido -> comprador
function canAccessRefund(authUser: AuthUser, refund: Refund): boolean {
  if (authUser.role !== UserRole.BUYER) return true;
  const request = ReturnService.getReturnById(refund.returnId);
  return OrderService.getOrderById(request.orderId).buyerId === authUser.id;
}

export const RefundController = {
  getById(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      if (typeof id !== "string") {
        res.status(400).json({ message: "El parámetro 'id' es requerido." });
        return;
      }

      const refund = RefundService.getRefundById(id);
      if (!canAccessRefund(getAuthUser(res), refund)) {
        res.status(403).json({ message: "Solo puedes consultar tus propios reembolsos." });
        return;
      }

      res.status(200).json(refund);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  },

  getByReturn(req: Request, res: Response): void {
    try {
      const { returnId } = req.params;
      if (typeof returnId !== "string") {
        res.status(400).json({ message: "El parámetro 'returnId' es requerido." });
        return;
      }

      const refund = RefundService.getRefundByReturn(returnId);
      if (!canAccessRefund(getAuthUser(res), refund)) {
        res.status(403).json({ message: "Solo puedes consultar tus propios reembolsos." });
        return;
      }

      res.status(200).json(refund);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  },

  updateStatus(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      if (typeof id !== "string") {
        res.status(400).json({ message: "El parámetro 'id' es requerido." });
        return;
      }
      const { status } = req.body as { status: RefundStatus };
      const updated = RefundService.updateStatus(id, status);
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  },
};