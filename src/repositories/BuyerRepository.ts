import { Address, Buyer, CommercialStatus } from "../models/Buyer";
import { db, transaction } from "../db/transaction";
import { Prisma } from "../generated/prisma/client";
import { isUuid } from "../db/ids";

// PostgreSQL: tabla buyers + buyer_addresses (una fila por dirección).
// La dirección principal es la que tiene is_primary = true; las demás se ordenan por position.

const buyerWithAddresses = {
  include: { addresses: { orderBy: { position: "asc" } } },
} satisfies Prisma.BuyerDefaultArgs;

type BuyerRow = Prisma.BuyerGetPayload<typeof buyerWithAddresses>;
type AddressRow = BuyerRow["addresses"][number];

function toAddress(row: AddressRow): Address {
  return { street: row.street, city: row.city, country: row.country, postalCode: row.postalCode };
}

function toBuyer(row: BuyerRow): Buyer {
  const primary = row.addresses.find((address) => address.isPrimary);
  if (!primary) {
    throw new Error(`El comprador ${row.userId} no tiene dirección principal.`);
  }
  return {
    userId: row.userId,
    primaryAddress: toAddress(primary),
    additionalAddresses: row.addresses.filter((a) => !a.isPrimary).map(toAddress),
    commercialStatus: row.commercialStatus as CommercialStatus,
  };
}

// Solo los campos de la dirección: nunca se guarda lo que el cliente agregue de más al body
function addressColumns(address: Address) {
  return {
    street: address.street,
    city: address.city,
    country: address.country,
    postalCode: address.postalCode,
  };
}

export const BuyerRepository = {
  async findAll(): Promise<Buyer[]> {
    const rows = await db().buyer.findMany(buyerWithAddresses);
    return rows.map(toBuyer);
  },

  async findByUserId(userId: string): Promise<Buyer | undefined> {
    if (!isUuid(userId)) return undefined;
    const row = await db().buyer.findUnique({ where: { userId }, ...buyerWithAddresses });
    return row ? toBuyer(row) : undefined;
  },

  async create(buyer: Buyer): Promise<Buyer> {
    const row = await db().buyer.create({
      data: {
        userId: buyer.userId,
        commercialStatus: buyer.commercialStatus,
        addresses: {
          create: [
            { ...addressColumns(buyer.primaryAddress), isPrimary: true, position: 0 },
            ...buyer.additionalAddresses.map((address, index) => ({
              ...addressColumns(address),
              position: index + 1,
            })),
          ],
        },
      },
      ...buyerWithAddresses,
    });
    return toBuyer(row);
  },

  // Agrega una dirección adicional al final de la lista
  async addAddress(userId: string, address: Address): Promise<Buyer | undefined> {
    if (!isUuid(userId)) return undefined;
    return transaction(async () => {
      const last = await db().buyerAddress.aggregate({
        where: { buyerId: userId },
        _max: { position: true },
      });
      await db().buyerAddress.create({
        data: { ...addressColumns(address), buyerId: userId, position: (last._max.position ?? 0) + 1 },
      });
      return this.findByUserId(userId);
    });
  },

  async update(userId: string, updatedFields: Partial<Buyer>): Promise<Buyer | undefined> {
    if (!isUuid(userId)) return undefined;
    return transaction(async () => {
      const exists = await db().buyer.findUnique({ where: { userId }, select: { userId: true } });
      if (!exists) return undefined;

      if (updatedFields.commercialStatus !== undefined) {
        await db().buyer.update({
          where: { userId },
          data: { commercialStatus: updatedFields.commercialStatus },
        });
      }

      if (updatedFields.primaryAddress !== undefined) {
        await db().buyerAddress.deleteMany({ where: { buyerId: userId, isPrimary: true } });
        await db().buyerAddress.create({
          data: {
            ...addressColumns(updatedFields.primaryAddress),
            buyerId: userId,
            isPrimary: true,
            position: 0,
          },
        });
      }

      if (updatedFields.additionalAddresses !== undefined) {
        await db().buyerAddress.deleteMany({ where: { buyerId: userId, isPrimary: false } });
        await db().buyerAddress.createMany({
          data: updatedFields.additionalAddresses.map((address, index) => ({
            ...addressColumns(address),
            buyerId: userId,
            position: index + 1,
          })),
        });
      }

      return this.findByUserId(userId);
    });
  },
};
