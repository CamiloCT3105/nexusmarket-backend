import { randomUUID } from "crypto";
import { Refund, RefundStatus } from "../models/Refund";
import { RefundRepository } from "../repositories/RefundRepository";
import { ConflictError, NotFoundError, ValidationError } from "../errors/AppError";

const allowedTransitions: Record<RefundStatus, RefundStatus[]> = {
  [RefundStatus.PENDING]: [RefundStatus.COMPLETED],
  [RefundStatus.COMPLETED]: [],
};

export const RefundService = {
  // Lo llama ReturnService al aprobar una devolución. No se expone por HTTP:
  // un reembolso solo puede nacer de una devolución aprobada.
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
      amount,
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

    return (await RefundRepository.update(refundId, { status: newStatus }))!;
  },
};
