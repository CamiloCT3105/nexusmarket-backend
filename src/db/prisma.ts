import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { env } from "../config/env";

// Un único cliente (con su pool de conexiones) para toda la aplicación
const adapter = new PrismaPg({ connectionString: env.databaseUrl });

export const prisma = new PrismaClient({ adapter });

// Falla rápido y con un mensaje claro si PostgreSQL no está disponible
export async function checkPostgresConnection(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `No se pudo conectar a PostgreSQL (${detail}). ¿Ejecutaste \`npm run db:up\` y \`npm run db:migrate\`?`
    );
  }
}
