import dotenv from "dotenv";

dotenv.config();

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  // Fallar al arrancar es mejor que correr con un sistema de login inseguro
  throw new Error("La variable de entorno JWT_SECRET es obligatoria.");
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "La variable de entorno DATABASE_URL es obligatoria (ver .env.example y docker-compose.yml)."
  );
}

const mongoUrl = process.env.MONGO_URL;
if (!mongoUrl) {
  throw new Error(
    "La variable de entorno MONGO_URL es obligatoria (ver .env.example y docker-compose.yml)."
  );
}

// Orígenes (frontends) que pueden llamar a la API desde el navegador, separados por coma.
// Por defecto, el servidor de desarrollo de Vite (React).
const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin !== "");

// Número entero positivo desde una variable de entorno; si falta o no es válido, el valor por defecto
function positiveInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

// Proxies de confianza delante de la API (en Render son 3 saltos). Con esto Express toma la IP real del
// cliente desde X-Forwarded-For; sin proxy debe quedar en false, o cualquiera podría falsear su IP.
// Acepta un número de saltos ("1"), "true"/"false" o una lista de IP/subredes (formato de Express).
function trustProxy(): boolean | number | string {
  const raw = (process.env.TRUST_PROXY ?? "").trim();
  if (raw === "" || raw === "false") return false;
  if (raw === "true") return true;
  return /^\d+$/.test(raw) ? Number(raw) : raw;
}

export const env = {
  databaseUrl,
  corsOrigins,
  mongoUrl,
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret,
  jwtExpiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS) || 28800,
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
  adminDocumentNumber: process.env.ADMIN_DOCUMENT_NUMBER,
  trustProxy: trustProxy(),
  rateLimit: {
    // Intentos FALLIDOS de login por IP y correo en 15 minutos (frena adivinar la clave de una cuenta)
    loginPerAccount: positiveInt("RATE_LIMIT_LOGIN_PER_ACCOUNT", 10),
    // Intentos FALLIDOS de login por IP en 15 minutos, sumando todos los correos (frena barridos)
    loginPerIp: positiveInt("RATE_LIMIT_LOGIN_PER_IP", 100),
    // Cuentas nuevas por IP en una hora
    registerPerIp: positiveInt("RATE_LIMIT_REGISTER_PER_IP", 30),
  },
};