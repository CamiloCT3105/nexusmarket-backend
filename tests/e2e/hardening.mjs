// Endurecimiento de la API pública: encabezados de seguridad, tamaño del cuerpo y límites de
// peticiones en login y registro (RN-66, RN-67).
//
// run.mjs arranca el servidor para esta suite con límites bajos y TRUST_PROXY=loopback, así que
// cada caso simula un cliente distinto enviando su propia IP en X-Forwarded-For.
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3999";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const LOGIN_PER_ACCOUNT = Number(process.env.E2E_LIMIT_LOGIN_PER_ACCOUNT ?? 3);
const LOGIN_PER_IP = Number(process.env.E2E_LIMIT_LOGIN_PER_IP ?? 6);
const REGISTER_PER_IP = Number(process.env.E2E_LIMIT_REGISTER_PER_IP ?? 2);
const RUN = Date.now();
let failures = 0;

function check(label, condition, detail) {
  if (!condition) failures++;
  console.log(`${condition ? "OK  " : "FAIL"} ${label}${condition ? "" : " -> " + JSON.stringify(detail)}`);
}

async function post(path, body, ip, raw) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(ip ? { "X-Forwarded-For": ip } : {}) },
    body: raw ?? JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, headers: res.headers, data };
}

const login = (email, password, ip) => post("/api/auth/login", { email, password }, ip);
const statuses = async (n, fn) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push((await fn(i)).status);
  return out;
};

// ─── Encabezados de seguridad ─────────────────────────────────────────────────
const health = await fetch(`${BASE}/health`);
check("X-Content-Type-Options: nosniff", health.headers.get("x-content-type-options") === "nosniff", health.headers.get("x-content-type-options"));
check("no expone X-Powered-By (Express)", health.headers.get("x-powered-by") === null, health.headers.get("x-powered-by"));
check("envía Strict-Transport-Security", (health.headers.get("strict-transport-security") ?? "").includes("max-age"), health.headers.get("strict-transport-security"));
check("envía X-Frame-Options", health.headers.get("x-frame-options") !== null, health.headers.get("x-frame-options"));

// ─── Cuerpo de la petición ────────────────────────────────────────────────────
const huge = await post("/api/auth/login", null, "198.51.100.1", JSON.stringify({ email: "x@x.test", password: "a".repeat(200_000) }));
check("cuerpo de más de 100 kB -> 413", huge.status === 413, huge.status);
check("el 413 trae un mensaje en JSON", typeof huge.data?.message === "string", huge.data);

const broken = await post("/api/auth/login", null, "198.51.100.2", "{ esto no es json");
check("JSON mal formado -> 400 con mensaje", broken.status === 400 && typeof broken.data?.message === "string", broken);

// ─── Login: intentos fallidos por cuenta ──────────────────────────────────────
const target = `victima-${RUN}@hardening.test`;
const attacker = "203.0.113.10";
const failed = await statuses(LOGIN_PER_ACCOUNT, () => login(target, "clave-mala", attacker));
check(`los primeros ${LOGIN_PER_ACCOUNT} intentos fallidos -> 401`, failed.every((s) => s === 401), failed);

const blocked = await login(target, "clave-mala", attacker);
check("el siguiente intento contra la misma cuenta -> 429", blocked.status === 429, blocked.status);
check("el 429 trae un mensaje en español", /intentos fallidos/i.test(blocked.data?.message ?? ""), blocked.data);
check("el 429 indica cuándo reintentar (Retry-After)", Number(blocked.headers.get("retry-after")) > 0, blocked.headers.get("retry-after"));
check("informa el límite con los encabezados estándar RateLimit", blocked.headers.get("ratelimit-policy") !== null, [...blocked.headers.keys()]);

const otherClient = await login(target, "clave-mala", "203.0.113.11");
check("la misma cuenta desde otra IP no queda bloqueada (el atacante no bloquea al dueño)", otherClient.status === 401, otherClient.status);

const sameIpOtherAccount = await login(ADMIN_EMAIL, ADMIN_PASSWORD, attacker);
check("desde la IP bloqueada, otra cuenta sí puede entrar", sameIpOtherAccount.status === 200, sameIpOtherAccount.status);

// ─── Login: los aciertos no cuentan ───────────────────────────────────────────
const classroom = "203.0.113.20";
const ok = await statuses(LOGIN_PER_IP + 2, () => login(ADMIN_EMAIL, ADMIN_PASSWORD, classroom));
check(`${LOGIN_PER_IP + 2} inicios de sesión correctos seguidos desde la misma IP -> todos 200`, ok.every((s) => s === 200), ok);

// ─── Login: barrido de cuentas desde una IP ───────────────────────────────────
const sweeper = "203.0.113.30";
const sweep = await statuses(LOGIN_PER_IP, (i) => login(`barrido-${i}-${RUN}@hardening.test`, "clave-mala", sweeper));
check(`${LOGIN_PER_IP} fallos con correos distintos -> 401`, sweep.every((s) => s === 401), sweep);
const sweepBlocked = await login(`barrido-extra-${RUN}@hardening.test`, "clave-mala", sweeper);
check("el siguiente fallo desde esa IP -> 429 aunque el correo sea nuevo", sweepBlocked.status === 429, sweepBlocked.status);
check("el mensaje habla de la red, no de una cuenta", /tu red/i.test(sweepBlocked.data?.message ?? ""), sweepBlocked.data);

// ─── Registro: cuentas nuevas por IP ──────────────────────────────────────────
const register = (i, ip) =>
  post(
    "/api/auth/register",
    { fullName: `Hardening ${i}`, email: `registro-${i}-${RUN}@hardening.test`, documentNumber: `HRD-${RUN % 1e8}-${i}`, password: "ClaveSegura123" },
    ip
  );
const farm = "203.0.113.40";
const created = await statuses(REGISTER_PER_IP, (i) => register(i, farm));
check(`los primeros ${REGISTER_PER_IP} registros desde una IP -> 201`, created.every((s) => s === 201), created);
const farmBlocked = await register("extra", farm);
check("el siguiente registro desde esa IP -> 429", farmBlocked.status === 429, farmBlocked.status);
check("el 429 de registro trae su mensaje", /demasiadas cuentas/i.test(farmBlocked.data?.message ?? ""), farmBlocked.data);
const neighbour = await register("vecino", "203.0.113.41");
check("desde otra IP se puede seguir registrando", neighbour.status === 201, neighbour.status);

console.log(failures === 0 ? "\nENDURECIMIENTO OK" : `\n${failures} FALLO(S)`);
process.exitCode = failures === 0 ? 0 : 1;
