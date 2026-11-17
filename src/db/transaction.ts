import { AsyncLocalStorage } from "async_hooks";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "./prisma";

// Unidad de trabajo para los servicios.
//
// Un servicio envuelve varias operaciones en `transaction(async () => { ... })` y
// TODOS los repositorios SQL que se usen dentro escriben en la misma transacción,
// sin tener que pasar el cliente de mano en mano: `db()` lo encuentra solo gracias
// a AsyncLocalStorage. Si algo lanza un error, se deshace todo.
//
// Los repositorios que aún están en memoria simplemente lo ignoran.

type DbClient = typeof prisma | Prisma.TransactionClient;

const currentTransaction = new AsyncLocalStorage<Prisma.TransactionClient>();

// Cliente que deben usar los repositorios SQL: el de la transacción activa, o el global
export function db(): DbClient {
  return currentTransaction.getStore() ?? prisma;
}

export async function transaction<T>(work: () => Promise<T>): Promise<T> {
  // Transacción anidada: se reutiliza la exterior (todo o nada)
  if (currentTransaction.getStore()) {
    return work();
  }
  return prisma.$transaction((tx) => currentTransaction.run(tx, work));
}
