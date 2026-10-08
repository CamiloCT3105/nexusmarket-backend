export interface CartItem {
  productId: string;
  quantity: number;
}

export interface Cart {
  buyerId: string;
  items: CartItem[];
}