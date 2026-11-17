// Ejecuta las pruebas de punta a punta (e2e) contra un servidor real y bases de datos reales.
//
//   npm run test:e2e
//
// Requisitos: Docker con PostgreSQL y MongoDB levantados (`npm run db:up`).
//
// Usa bases de datos de PRUEBA separadas (por defecto `nexusmarket_e2e` en ambos motores),
// que se vacían al empezar: tus datos de desarrollo no se tocan. Se pueden cambiar con
// E2E_DATABASE_URL y E2E_MONGO_URL.
//
// Pasos: crea la base de prueba si no existe → aplica migraciones → la vacía → compila →
// arranca el servidor → corre las suites → lo reinicia → comprueba la persistencia.

import { spawn, spawnSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";
import mongoose from "mongoose";

dotenv.config({ quiet: true });

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SUITES = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = join(ROOT, ".e2e-build");
const STATE_DIR = mkdtempSync(join(tmpdir(), "nexusmarket-e2e-"));
const PORT = process.env.E2E_PORT ?? "3999";
const BASE_URL = `http://localhost:${PORT}`;
const ADMIN_EMAIL = "admin@e2e.test";
const ADMIN_PASSWORD = "AdminE2E12345";
const CORS_ORIGIN = "http://localhost:5173";
const TEST_DB = "nexusmarket_e2e";

// ─── Configuración de las bases de prueba ──────────────────────────────────────

function withDatabase(url, name) {
  if (!url) throw new Error("Falta DATABASE_URL o MONGO_URL en .env (ver .env.example).");
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}
const databaseName = (url) => new URL(url).pathname.replace(/^\//, "");

const PG_URL = process.env.E2E_DATABASE_URL ?? withDatabase(process.env.DATABASE_URL, TEST_DB);
const MONGO_URL = process.env.E2E_MONGO_URL ?? withDatabase(process.env.MONGO_URL, TEST_DB);

// Protección: estas pruebas BORRAN todo. Nunca contra una base que no sea de prueba.
for (const url of [PG_URL, MONGO_URL]) {
  const name = databaseName(url);
  if (!/(e2e|test)/i.test(name)) {
    console.error(`Abortado: la base "${name}" no parece de prueba (su nombre debe contener "e2e" o "test").`);
    process.exit(1);
  }
}

// ─── Utilidades ────────────────────────────────────────────────────────────────

function step(title) {
  console.log(`\n\x1b[1m▶ ${title}\x1b[0m`);
}

// Ejecuta una herramienta de node_modules con el mismo Node, sin pasar por un shell
// (evita npx/.cmd en Windows y el riesgo de argumentos sin escapar)
function runToolOrFail(scriptPath, args, env = {}) {
  const result = spawnSync(process.execPath, [join(ROOT, scriptPath), ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`Falló: ${scriptPath} ${args.join(" ")}`);
  }
}

const PRISMA_CLI = "node_modules/prisma/build/index.js";
const TSC_CLI = "node_modules/typescript/bin/tsc";

async function ensurePostgresDatabase() {
  const admin = new pg.Client({ connectionString: withDatabase(PG_URL, "postgres") });
  await admin.connect();
  const name = databaseName(PG_URL);
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${name.replace(/"/g, "")}"`);
    console.log(`Base de prueba creada: ${name}`);
  }
  await admin.end();
}

async function cleanDatabases() {
  const client = new pg.Client({ connectionString: PG_URL });
  await client.connect();
  const { rows } = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'"
  );
  if (rows.length > 0) {
    await client.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(", ")} CASCADE`);
  }
  await client.end();

  await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

let server;
let serverLog = "";

async function startServer() {
  serverLog = "";
  server = spawn(process.execPath, [join(BUILD_DIR, "index.js")], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT,
      NODE_ENV: "test",
      JWT_SECRET: "e2e-secret-solo-para-pruebas",
      ADMIN_EMAIL,
      ADMIN_PASSWORD,
      ADMIN_DOCUMENT_NUMBER: "E2E-ADMIN-001",
      DATABASE_URL: PG_URL,
      MONGO_URL,
      CORS_ORIGIN,
    },
  });
  server.stdout.on("data", (chunk) => (serverLog += chunk));
  server.stderr.on("data", (chunk) => (serverLog += chunk));

  for (let i = 0; i < 60; i++) {
    if (hasExited(server)) break;
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return;
    } catch {
      // todavía arrancando
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`El servidor no arrancó.\n${serverLog}`);
}

// Un proceso terminado por señal tiene exitCode null y signalCode definido: hay que mirar ambos
const hasExited = (child) => child.exitCode !== null || child.signalCode !== null;

async function stopServer() {
  if (!server || hasExited(server)) return;
  const exited = new Promise((r) => server.once("exit", r));
  server.kill();
  await exited;
}

const results = [];

function runSuite(label, file, mode) {
  console.log(`\n── ${label}`);
  const args = [join(SUITES, file), ...(mode ? [mode] : [])];
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    env: {
      ...process.env,
      E2E_BASE_URL: BASE_URL,
      E2E_ADMIN_EMAIL: ADMIN_EMAIL,
      E2E_ADMIN_PASSWORD: ADMIN_PASSWORD,
      E2E_CORS_ORIGIN: CORS_ORIGIN,
      E2E_STATE_DIR: STATE_DIR,
    },
    stdio: "inherit",
  });
  results.push({ label, ok: result.status === 0 });
}

// ─── Ejecución ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`PostgreSQL de prueba: ${databaseName(PG_URL)} · MongoDB de prueba: ${databaseName(MONGO_URL)}`);

  step("Preparando bases de datos de prueba");
  await ensurePostgresDatabase();
  runToolOrFail(PRISMA_CLI, ["migrate", "deploy"], { DATABASE_URL: PG_URL });
  await cleanDatabases();

  step("Compilando");
  rmSync(BUILD_DIR, { recursive: true, force: true });
  runToolOrFail(TSC_CLI, ["-p", ".", "--outDir", ".e2e-build", "--declaration", "false", "--declarationMap", "false", "--sourceMap", "false"]);

  step("Arrancando servidor y ejecutando suites");
  await startServer();
  // post-sales compara cifras exactas de los reportes: necesita la base vacía, va primero
  runSuite("Posventa y reportes", "post-sales.mjs");
  runSuite("Concurrencia de inventario y pedidos", "concurrency.mjs");
  runSuite("Flujo completo", "full-flow.mjs");
  runSuite("Perfiles y bodegas", "profiles.mjs", "setup");
  runSuite("Catálogo y carritos", "catalog-carts.mjs", "setup");
  runSuite("Registros simultáneos", "race.mjs");
  runSuite("Documento de identidad, catálogo y listados por rol", "listings.mjs");
  runSuite("CORS", "cors.mjs");
  await stopServer();

  step("Reiniciando servidor: los datos deben persistir");
  await startServer();
  runSuite("Persistencia de perfiles y bodegas", "profiles.mjs", "verify");
  runSuite("Persistencia de catálogo y carritos", "catalog-carts.mjs", "verify");
  await stopServer();

  // Un 500 inesperado queda registrado por el errorHandler: también cuenta como fallo
  const unexpected = serverLog.split("\n").filter((line) => /error/i.test(line));
  results.push({ label: "Sin errores 500 inesperados en el servidor", ok: unexpected.length === 0 });
  if (unexpected.length > 0) console.log(unexpected.join("\n"));
}

try {
  await main();
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  results.push({ label: "Preparación", ok: false });
} finally {
  await stopServer();
  rmSync(BUILD_DIR, { recursive: true, force: true });
  rmSync(STATE_DIR, { recursive: true, force: true });
}

step("Resumen");
for (const r of results) console.log(`${r.ok ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✘\x1b[0m"} ${r.label}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? "\n\x1b[32mTODAS LAS PRUEBAS PASARON\x1b[0m" : `\n\x1b[31m${failed} FALLARON\x1b[0m`);
process.exitCode = failed === 0 ? 0 : 1;
