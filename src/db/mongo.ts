import mongoose from "mongoose";
import { env } from "../config/env";
import { CartModel, InventoryMovementModel, ProductModel } from "./mongoModels";

// Conexión a MongoDB (catálogo, carritos y bitácora de movimientos).
// Falla rápido y con un mensaje claro si no está disponible.
export async function connectMongo(): Promise<void> {
  try {
    await mongoose.connect(env.mongoUrl, { serverSelectionTimeoutMS: 5000 });
    // Espera a que existan los índices (incluido el TTL de carritos) antes de atender peticiones
    await Promise.all([ProductModel.init(), CartModel.init(), InventoryMovementModel.init()]);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`No se pudo conectar a MongoDB (${detail}). ¿Ejecutaste \`npm run db:up\`?`);
  }
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
