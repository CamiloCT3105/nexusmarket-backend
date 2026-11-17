import app from "./app";
import { env } from "./config/env";
import { AuthService } from "./services/AuthService";
import { checkPostgresConnection, prisma } from "./db/prisma";

async function main(): Promise<void> {
  await checkPostgresConnection();
  await AuthService.seedAdmin();

  const server = app.listen(env.port, () => {
    console.log(`Servidor corriendo en http://localhost:${env.port}`);
  });

  // Cierre ordenado: deja de aceptar peticiones y libera las conexiones a la base de datos
  const shutdown = (signal: string) => {
    console.log(`${signal} recibido, cerrando servidor...`);
    server.close(() => {
      prisma.$disconnect().finally(() => process.exit(0));
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("No se pudo iniciar el servidor:", error instanceof Error ? error.message : error);
  process.exit(1);
});
