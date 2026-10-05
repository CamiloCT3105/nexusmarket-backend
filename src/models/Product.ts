export enum ProductType {
  PHYSICAL = "PHYSICAL",
  DIGITAL = "DIGITAL",
}

export enum ProductStatus {
  PUBLISHED = "PUBLISHED",
  SUSPENDED = "SUSPENDED",
  DISCONTINUED = "DISCONTINUED",
}

export interface Variant {
  id: string;
  name: string; // ej: "Color", "Talla"
  value: string; // ej: "Rojo", "M"
}

export interface Product {
  id: string;
  sellerId: string;
  name: string;
  description: string;
  price: number;
  type: ProductType;
  variants: Variant[];
  status: ProductStatus;
}