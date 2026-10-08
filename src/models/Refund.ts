export enum RefundStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
}

export interface Refund {
  id: string;
  returnId: string;
  amount: number;
  status: RefundStatus;
  createdAt: Date;
}