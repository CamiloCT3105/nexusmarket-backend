import { randomUUID } from "crypto";
import { Refund, RefundStatus } from "../models/Refund";
import { RefundRepository } from "../repositories/RefundRepository";

const allowedTransitions: Record<RefundStatus, RefundStatus[]> = {
  [RefundStatus.PENDING]: [RefundStatus.COMPLETED],
  [RefundStatus.COMPLETED]: [],
};

export const RefundService = {
  // Lo llama ReturnService al aprobar una devolución. No se expone por HTTP:
  // un reembolso solo puede nacer de una devolución aprobada.
  generateRefund(returnId: string, amount: number): Refund {
    if (amount <= 0) {
      throw new Error("El monto del reembolso debe ser mayor a cero.");
    }

    const existingRefund = RefundRepository.findByReturnId(returnId);
    if (existingRefund) {
      throw new Error("Esta devolución ya tiene un reembolso generado.");
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

  getRefundById(id: string): Refund {
    const refund = RefundRepository.findById(id);
    if (!refund) {
      throw new Error("Reembolso no encontrado.");
    }
    return refund;
  },

  getRefundByReturn(returnId: string): Refund {
    const refund = RefundRepository.findByReturnId(returnId);
    if (!refund) {
      throw new Error("No existe un reembolso para esta devolución.");
    }
    return refund;
  },

  updateStatus(refundId: string, newStatus: RefundStatus): Refund {
    const refund = this.getRefundById(refundId);

    if (!allowedTransitions[refund.status].includes(newStatus)) {
      throw new Error(
        `Transición inválida: no se puede pasar de ${refund.status} a ${newStatus}.`
      );
    }

    return RefundRepository.update(refundId, { status: newStatus })!;
  },
};