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
// Lo que vive FUERA de PostgreSQL (memoria hoy, MongoDB mañana) no puede deshacerse.
// Para eso está `afterCommit(fn)`: la acción se ejecuta solo si la transacción se
// confirma, así un rollback no deja, por ejemplo, movimientos de inventario fantasma.

type DbClient = typeof prisma | Prisma.TransactionClient;

type TransactionContext = {
  tx: Prisma.TransactionClient;
  afterCommit: Array<() => Promise<unknown>>;
};

const currentTransaction = new AsyncLocalStorage<TransactionContext>();

// Cliente que deben usar los repositorios SQL: el de la transacción activa, o el global
export function db(): DbClient {
  return currentTransaction.getStore()?.tx ?? prisma;
}

export async function transaction<T>(work: () => Promise<T>): Promise<T> {
  // Transacción anidada: se reutiliza la exterior (todo o nada)
  if (currentTransaction.getStore()) {
    return work();
  }

  const afterCommit: TransactionContext["afterCommit"] = [];
  const result = await prisma.$transaction((tx) =>
    currentTransaction.run({ tx, afterCommit }, work)
  );

  // Confirmada: ahora sí se ejecutan las acciones diferidas, en orden
  for (const action of afterCommit) {
    await action();
  }
  return result;
}

// Ejecuta `action` cuando la transacción activa se confirme, o de inmediato si no hay ninguna
export async function afterCommit(action: () => Promise<unknown>): Promise<void> {
  const context = currentTransaction.getStore();
  if (context) {
    context.afterCommit.push(action);
  } else {
    await action();
  }
}
