import app from "./app";
import { env } from "./config/env";

app.listen(env.port, () => {
  console.log(`Servidor corriendo en http://localhost:${env.port}`);
});