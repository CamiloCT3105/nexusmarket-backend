import app from "./app";
import { env } from "./config/env";
import { AuthService } from "./services/AuthService";

async function main(): Promise<void> {
  await AuthService.seedAdmin();

  app.listen(env.port, () => {
    console.log(`Servidor corriendo en http://localhost:${env.port}`);
  });
}

main().catch((error) => {
  console.error("No se pudo iniciar el servidor:", error);
  process.exit(1);
});
