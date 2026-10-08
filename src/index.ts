import app from "./app";
import { env } from "./config/env";
import { AuthService } from "./services/AuthService";

AuthService.seedAdmin();

app.listen(env.port, () => {
  console.log(`Servidor corriendo en http://localhost:${env.port}`);
});