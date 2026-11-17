// Pruebas de perfiles y bodegas en PostgreSQL.
// Uso: node profiles.mjs setup   -> crea datos y guarda ids en state.json
//      node profiles.mjs verify  -> (tras reiniciar el servidor) comprueba que siguen ahí
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3999";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@e2e.test";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "AdminE2E12345";
const STATE = join(process.env.E2E_STATE_DIR ?? dirname(fileURLToPath(import.meta.url)), "profiles-state.json");
const RUN = Date.now().toString(36);
// Documento de identidad único por usuario creado en esta corrida
let docSeq = 0;
const nextDoc = () => `D${RUN}${++docSeq}`.toUpperCase();
let failures = 0;

async function call(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}
async function expect(label, expected, promise) {
  const r = await promise;
  const ok = r.status === expected;
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} [${r.status}${ok ? "" : " != " + expected}] ${label}${ok ? "" : " -> " + JSON.stringify(r.data)}`);
  return r.data;
}
function check(label, condition, detail) {
  if (!condition) failures++;
  console.log(`${condition ? "OK  " : "FAIL"} ${label}${condition ? "" : " -> " + JSON.stringify(detail)}`);
}
const login = async (email, password) =>
  (await expect(`login ${email}`, 200, call("POST", "/api/auth/login", { body: { email, password } }))).token;

const mode = process.argv[2];
const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

if (mode === "setup") {
  // --- Comprador y direcciones
  const buyerEmail = `pbuyer-${RUN}@smoke.test`;
  const buyerUser = await expect("registro comprador", 201, call("POST", "/api/auth/register", { body: { documentNumber: nextDoc(), fullName: "Perfil", email: buyerEmail, password: "Buyer12345" } }));
  const buyer = await login(buyerEmail, "Buyer12345");
  await expect("perfil sin dirección -> 400", 400, call("POST", "/api/buyers", { token: buyer, body: {} }));
  const bad = await expect("dirección incompleta -> 400", 400, call("POST", "/api/buyers", { token: buyer, body: { primaryAddress: { street: "Calle 1" } } }));
  check("mensaje indica campos faltantes", /city, country, postalCode/.test(bad.message), bad);
  const primary = { street: "Calle 1 #2-3", city: "Bogotá", country: "CO", postalCode: "110111", extra: "ignorar" };
  const profile = await expect("perfil comprador", 201, call("POST", "/api/buyers", { token: buyer, body: { primaryAddress: primary } }));
  check("no guarda campos extra del body", !("extra" in profile.primaryAddress), profile.primaryAddress);
  await expect("perfil duplicado -> 409", 409, call("POST", "/api/buyers", { token: buyer, body: { primaryAddress: primary } }));
  await expect("dirección adicional 1", 200, call("PATCH", `/api/buyers/${buyerUser.id}/addresses`, { token: buyer, body: { street: "Cra 7", city: "Medellín", country: "CO", postalCode: "050001" } }));
  const withTwo = await expect("dirección adicional 2", 200, call("PATCH", `/api/buyers/${buyerUser.id}/addresses`, { token: buyer, body: { street: "Av 68", city: "Cali", country: "CO", postalCode: "760001" } }));
  check("orden de direcciones conservado", withTwo.additionalAddresses.map((a) => a.city).join(",") === "Medellín,Cali", withTwo.additionalAddresses);
  await expect("dirección adicional inválida -> 400", 400, call("PATCH", `/api/buyers/${buyerUser.id}/addresses`, { token: buyer, body: { street: "" } }));
  await expect("estado comercial inválido -> 400", 400, call("PATCH", `/api/buyers/${buyerUser.id}/commercial-status`, { token: admin, body: { commercialStatus: "NOPE" } }));
  const restricted = await expect("estado comercial RESTRICTED", 200, call("PATCH", `/api/buyers/${buyerUser.id}/commercial-status`, { token: admin, body: { commercialStatus: "RESTRICTED" } }));
  check("estado comercial actualizado sin perder direcciones", restricted.commercialStatus === "RESTRICTED" && restricted.additionalAddresses.length === 2, restricted);

  // --- Vendedor y bodegas
  const sellerUser = await expect("admin crea vendedor", 201, call("POST", "/api/users", { token: admin, body: { documentNumber: nextDoc(), fullName: "Vend", email: `pseller-${RUN}@smoke.test`, password: "Seller12345", role: "SELLER" } }));
  const onboard = await expect("onboard vendedor", 201, call("POST", "/api/sellers", { token: admin, body: { userId: sellerUser.id } }));
  check("vendedor nace sin bodegas", Array.isArray(onboard.warehouseIds) && onboard.warehouseIds.length === 0, onboard);
  await expect("onboard duplicado -> 409", 409, call("POST", "/api/sellers", { token: admin, body: { userId: sellerUser.id } }));
  const seller = await login(`pseller-${RUN}@smoke.test`, "Seller12345");

  await expect("tipo de bodega inválido -> 400", 400, call("POST", "/api/warehouses", { token: admin, body: { type: "NOPE", location: "X" } }));
  await expect("bodega sin ubicación -> 400", 400, call("POST", "/api/warehouses", { token: admin, body: { type: "MARKETPLACE" } }));
  const own = await expect("vendedor crea bodega propia", 201, call("POST", "/api/warehouses", { token: seller, body: { type: "SELLER", location: "Bodega A" } }));
  const s1 = await expect("ver vendedor", 200, call("GET", `/api/sellers/${sellerUser.id}`, { token: admin }));
  check("bodega creada aparece sola en warehouseIds (antes no)", s1.warehouseIds.includes(own.id), s1);

  const mkt = await expect("admin crea bodega MARKETPLACE", 201, call("POST", "/api/warehouses", { token: admin, body: { type: "MARKETPLACE", location: "Central" } }));
  check("MARKETPLACE sin sellerId", !("sellerId" in mkt), mkt);
  await expect("asignar MARKETPLACE a vendedor -> 400", 400, call("PATCH", `/api/sellers/${sellerUser.id}/warehouses`, { token: admin, body: { warehouseId: mkt.id } }));
  await expect("asignar bodega inexistente -> 404", 404, call("PATCH", `/api/sellers/${sellerUser.id}/warehouses`, { token: admin, body: { warehouseId: "00000000-0000-0000-0000-000000000000" } }));

  // Bodega SELLER de otro vendedor, reasignada por el admin a este vendedor
  const other = await expect("admin crea otro vendedor", 201, call("POST", "/api/users", { token: admin, body: { documentNumber: nextDoc(), fullName: "Otro", email: `pother-${RUN}@smoke.test`, password: "Seller12345", role: "SELLER" } }));
  await expect("onboard otro vendedor", 201, call("POST", "/api/sellers", { token: admin, body: { userId: other.id } }));
  const otherWh = await expect("bodega del otro vendedor", 201, call("POST", "/api/warehouses", { token: admin, body: { type: "SELLER", location: "Bodega B", sellerId: other.id } }));
  const s2 = await expect("asignar bodega vía /sellers", 200, call("PATCH", `/api/sellers/${sellerUser.id}/warehouses`, { token: admin, body: { warehouseId: otherWh.id } }));
  check("vendedor ahora tiene 2 bodegas", s2.warehouseIds.length === 2, s2);
  const o2 = await expect("ver otro vendedor", 200, call("GET", `/api/sellers/${other.id}`, { token: admin }));
  check("el otro vendedor ya no la tiene (sin duplicados)", o2.warehouseIds.length === 0, o2);
  await expect("vendedor no ve bodega ajena -> 403", 403, call("GET", `/api/warehouses/${mkt.id}`, { token: seller }));
  await expect("link a vendedor inexistente -> 404", 404, call("PATCH", `/api/warehouses/${own.id}/link-seller`, { token: admin, body: { sellerId: "00000000-0000-0000-0000-000000000000" } }));

  writeFileSync(STATE, JSON.stringify({ buyerId: buyerUser.id, sellerId: sellerUser.id, ownWh: own.id, otherWh: otherWh.id, buyerEmail }));
} else if (mode === "verify") {
  const s = JSON.parse(readFileSync(STATE, "utf8"));
  const b = await expect("perfil comprador tras reinicio", 200, call("GET", `/api/buyers/${s.buyerId}`, { token: admin }));
  check("direcciones y estado persisten", b.primaryAddress.city === "Bogotá" && b.additionalAddresses.length === 2 && b.commercialStatus === "RESTRICTED", b);
  const sel = await expect("vendedor tras reinicio", 200, call("GET", `/api/sellers/${s.sellerId}`, { token: admin }));
  check("bodegas del vendedor persisten", sel.warehouseIds.length === 2 && sel.warehouseIds.includes(s.ownWh) && sel.warehouseIds.includes(s.otherWh), sel);
  const wh = await expect("bodegas por vendedor tras reinicio", 200, call("GET", `/api/warehouses/seller/${s.sellerId}`, { token: admin }));
  check("listado coincide", wh.length === 2, wh);
}

console.log(failures === 0 ? `\n${mode.toUpperCase()} OK` : `\n${failures} FALLO(S)`);
process.exitCode = failures === 0 ? 0 : 1;
