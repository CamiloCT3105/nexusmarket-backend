export interface Invoice {
  id: string;
  orderId: string;
  buyerId: string;
  amount: number;
  issuedAt: Date;
}