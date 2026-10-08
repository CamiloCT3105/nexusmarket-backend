import dotenv from "dotenv";

dotenv.config();

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  // Fallar al arrancar es mejor que correr con un sistema de login inseguro
  throw new Error("La variable de entorno JWT_SECRET es obligatoria.");
}

export const env = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret,
  jwtExpiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS) || 28800,
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
};