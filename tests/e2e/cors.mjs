// CORS: solo los orígenes configurados en CORS_ORIGIN pueden llamar a la API desde un navegador
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3999";
const ALLOWED = process.env.E2E_CORS_ORIGIN ?? "http://localhost:5173";
const BLOCKED = "http://sitio-malicioso.example";
let failures = 0;

function check(label, condition, detail) {
  if (!condition) failures++;
  console.log(`${condition ? "OK  " : "FAIL"} ${label}${condition ? "" : " -> " + JSON.stringify(detail)}`);
}

// Preflight: lo que envía el navegador antes de un POST con JSON y Authorization
const preflight = (origin) =>
  fetch(`${BASE}/api/auth/login`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,authorization",
    },
  });

const ok = await preflight(ALLOWED);
check("preflight desde el frontend permitido -> 204", ok.status === 204, ok.status);
check("responde Access-Control-Allow-Origin con ese origen", ok.headers.get("access-control-allow-origin") === ALLOWED, ok.headers.get("access-control-allow-origin"));
const allowedHeaders = (ok.headers.get("access-control-allow-headers") ?? "").toLowerCase();
check("permite los headers Authorization y Content-Type", allowedHeaders.includes("authorization") && allowedHeaders.includes("content-type"), allowedHeaders);

const bad = await preflight(BLOCKED);
check("un origen no configurado NO recibe Access-Control-Allow-Origin", bad.headers.get("access-control-allow-origin") === null, bad.headers.get("access-control-allow-origin"));

const get = await fetch(`${BASE}/health`, { headers: { Origin: ALLOWED } });
check("petición normal desde el frontend permitido incluye el header", get.headers.get("access-control-allow-origin") === ALLOWED, get.headers.get("access-control-allow-origin"));

console.log(failures === 0 ? "\nCORS OK" : `\n${failures} FALLO(S)`);
process.exitCode = failures === 0 ? 0 : 1;
