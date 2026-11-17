import { Request, Response } from "express";
import { RefundService } from "../services/RefundService";
import { ReturnService } from "../services/ReturnService";
import { OrderService } from "../services/OrderService";
import { Refund, RefundStatus } from "../models/Refund";
import { AuthUser } from "../models/AuthUser";
import { UserRole } from "../models/User";
import { getAuthUser } from "../middlewares/authenticate";
import { ForbiddenError } from "../errors/AppError";
import { requireParam } from "../utils/params";
import { optionalEnum, pageRequest } from "../utils/query";

// Un BUYER solo ve sus reembolsos. Para saberlo hay que seguir la cadena:
// reembolso -> devolución -> pedido -> comprador
async function assertRefundAccess(authUser: AuthUser, refund: Refund): Promise<void> {
  if (authUser.role !== UserRole.BUYER) return;
  const request = await ReturnService.getReturnById(refund.returnId);
  const order = await OrderService.getOrderById(request.orderId);
  if (order.buyerId !== authUser.id) {
    throw new ForbiddenError("Solo puedes consultar tus propios reembolsos.");
  }
}

export const RefundController = {
  // GET /api/refunds?status=&page=&pageSize=  (el comprador ve solo los suyos)
  async list(req: Request, res: Response): Promise<void> {
    const page = await RefundService.listRefundsForViewer(
      getAuthUser(res),
      { status: optionalEnum(req, "status", Object.values(RefundStatus)) },
      pageRequest(req)
    );
    res.status(200).json(page);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const refund = await RefundService.getRefundById(requireParam(req, "id"));
    await assertRefundAccess(getAuthUser(res), refund);
    res.status(200).json(refund);
  },

  async getByReturn(req: Request, res: Response): Promise<void> {
    const refund = await RefundService.getRefundByReturn(requireParam(req, "returnId"));
    await assertRefundAccess(getAuthUser(res), refund);
    res.status(200).json(refund);
  },

  async updateStatus(req: Request, res: Response): Promise<void> {
    const { status } = req.body as { status: RefundStatus };
    const updated = await RefundService.updateStatus(requireParam(req, "id"), status);
    res.status(200).json(updated);
  },
};
