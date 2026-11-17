// Dos registros simultáneos con el mismo correo: uno debe ganar (201) y el otro recibir 409
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3999";
const RUN = Date.now().toString(36);
let docSeq = 0;
const nextDoc = () => `D${RUN}${++docSeq}`.toUpperCase();
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@e2e.test";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "AdminE2E12345";
const email = `race-${Date.now().toString(36)}@smoke.test`;
const register = () =>
  fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentNumber: nextDoc(), fullName: "Carrera", email, password: "Race12345" }),
  }).then((r) => r.status);

const statuses = (await Promise.all([register(), register(), register(), register()])).sort();
console.log("estados:", statuses.join(", "));
const created = statuses.filter((s) => s === 201).length;
const conflicts = statuses.filter((s) => s === 409).length;

const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: "Race12345" }),
});
console.log("login del ganador:", login.status);

const ok = created === 1 && conflicts === 3 && login.status === 200;
console.log(ok ? "CARRERA OK" : "CARRERA FALLÓ");
process.exitCode = ok ? 0 : 1;
