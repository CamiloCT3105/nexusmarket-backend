import { ReturnRequest } from "../models/ReturnRequest";
import { clone } from "./clone";

const returns: ReturnRequest[] = [];

export const ReturnRepository = {
  async findById(id: string): Promise<ReturnRequest | undefined> {
    const request = returns.find((r) => r.id === id);
    return request && clone(request);
  },

  async findByOrderId(orderId: string): Promise<ReturnRequest[]> {
    return clone(returns.filter((r) => r.orderId === orderId));
  },

  async findByOrderAndProduct(orderId: string, productId: string): Promise<ReturnRequest[]> {
    return clone(returns.filter((r) => r.orderId === orderId && r.productId === productId));
  },

  async findAll(): Promise<ReturnRequest[]> {
    return clone(returns);
  },

  async create(request: ReturnRequest): Promise<ReturnRequest> {
    returns.push(clone(request));
    return clone(request);
  },

  async update(id: string, updatedFields: Partial<ReturnRequest>): Promise<ReturnRequest | undefined> {
    const request = returns.find((r) => r.id === id);
    if (!request) return undefined;

    Object.assign(request, clone(updatedFields));
    return clone(request);
  },
};
