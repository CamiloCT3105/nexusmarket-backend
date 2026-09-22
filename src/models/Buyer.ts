export enum CommercialStatus {
  ACTIVE = "ACTIVE",
  RESTRICTED = "RESTRICTED",
}

export interface Address {
  street: string;
  city: string;
  country: string;
  postalCode: string;
}

// Buyer no repite los datos de User (fullName, email, etc.).
// En vez de eso, se relaciona con él mediante userId.
export interface Buyer {
  userId: string;
  primaryAddress: Address;
  additionalAddresses: Address[];
  commercialStatus: CommercialStatus;
}