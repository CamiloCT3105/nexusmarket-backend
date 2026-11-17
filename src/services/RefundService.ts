import { randomUUID } from "crypto";
import { Refund, RefundStatus } from "../models/Refund";
import { RefundRepository } from "../repositories/RefundRepository";
import { ConflictError, NotFoundError, ValidationError } from "../errors/AppError";
import { RefundFilter } from "../repositories/RefundRepository";
import { AuthUser } from "../models/AuthUser";
import { UserRole } from "../models/User";
import { Page, PageRequest } from "../utils/pagination";

const allowedTransitions: Record<RefundStatus, RefundStatus[]> = {
  [RefundStatus.PENDING]: [RefundStatus.COMPLETED],
  [RefundStatus.COMPLETED]: [],
};

export const RefundService = {
  // Lo llama ReturnService al aprobar una devolución (dentro de su transacción).
  // No se expone por HTTP: un reembolso solo puede nacer de una devolución aprobada.
  async generateRefund(returnId: string, amount: number): Promise<Refund> {
    if (amount <= 0) {
      throw new ValidationError("El monto del reembolso debe ser mayor a cero.");
    }

    const existingRefund = await RefundRepository.findByReturnId(returnId);
    if (existingRefund) {
      throw new ConflictError("Esta devolución ya tiene un reembolso generado.");
    }

    const refund: Refund = {
      id: randomUUID(),
      returnId,
      amount: Math.round(amount * 100) / 100,
      status: RefundStatus.PENDING,
      createdAt: new Date(),
    };

    return RefundRepository.create(refund);
  },

  async getRefundById(id: string): Promise<Refund> {
    const refund = await RefundRepository.findById(id);
    if (!refund) {
      throw new NotFoundError("Reembolso no encontrado.");
    }
    return refund;
  },

  async getRefundByReturn(returnId: string): Promise<Refund> {
    const refund = await RefundRepository.findByReturnId(returnId);
    if (!refund) {
      throw new NotFoundError("No existe un reembolso para esta devolución.");
    }
    return refund;
  },

  // El comprador ve solo los reembolsos de sus devoluciones; administrador y supervisor, todos
  async listRefundsForViewer(
    viewer: AuthUser,
    filter: Pick<RefundFilter, "status">,
    request: PageRequest
  ): Promise<Page<Refund>> {
    const buyerId = viewer.role === UserRole.BUYER ? viewer.id : undefined;
    return RefundRepository.findPage({ ...filter, buyerId }, request);
  },

  async listRefunds(): Promise<Refund[]> {
    return RefundRepository.findAll();
  },

  async updateStatus(refundId: string, newStatus: RefundStatus): Promise<Refund> {
    const refund = await this.getRefundById(refundId);

    if (!allowedTransitions[refund.status].includes(newStatus)) {
      throw new ValidationError(
        `Transición inválida: no se puede pasar de ${refund.status} a ${newStatus}.`
      );
    }

    if (!(await RefundRepository.updateStatusIf(refundId, refund.status, newStatus))) {
      throw new ConflictError("El reembolso cambió de estado mientras se procesaba. Intenta de nuevo.");
    }
    return this.getRefundById(refundId);
  },
};
