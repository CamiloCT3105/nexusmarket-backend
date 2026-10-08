import { ReturnRequest } from "../models/ReturnRequest";

const returns: ReturnRequest[] = [];

export const ReturnRepository = {
  findById(id: string): ReturnRequest | undefined {
    return returns.find((request) => request.id === id);
  },

  findByOrderId(orderId: string): ReturnRequest[] {
    return returns.filter((request) => request.orderId === orderId);
  },

  findByOrderAndProduct(orderId: string, productId: string): ReturnRequest[] {
    return returns.filter(
      (request) => request.orderId === orderId && request.productId === productId
    );
  },

  create(request: ReturnRequest): ReturnRequest {
    returns.push(request);
    return request;
  },

  update(id: string, updatedFields: Partial<ReturnRequest>): ReturnRequest | undefined {
    const request = this.findById(id);
    if (!request) return undefined;

    Object.assign(request, updatedFields);
    return request;
  },
};