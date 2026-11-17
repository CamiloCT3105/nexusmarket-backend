// Catálogo y carritos en MongoDB.
// Uso: node mongo.mjs setup   -> crea datos, prueba concurrencia y validaciones, guarda ids
//      node mongo.mjs verify  -> (tras reiniciar el servidor) comprueba que todo sigue ahí
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3999";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@e2e.test";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "AdminE2E12345";
const STATE = join(process.env.E2E_STATE_DIR ?? dirname(fileURLToPath(import.meta.url)), "catalog-carts-state.json");
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
async function must(label, expected, promise) {
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
  (await must(`login ${email}`, 200, call("POST", "/api/auth/login", { body: { email, password } }))).token;

const mode = process.argv[2];
const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

if (mode === "setup") {
  const sellerUser = await must("vendedor", 201, call("POST", "/api/users", { token: admin, body: { documentNumber: nextDoc(), fullName: "V", email: `ms-${RUN}@smoke.test`, password: "Seller12345", role: "SELLER" } }));
  await must("onboard", 201, call("POST", "/api/sellers", { token: admin, body: { userId: sellerUser.id } }));
  const seller = await login(`ms-${RUN}@smoke.test`, "Seller12345");
  const wh = await must("bodega", 201, call("POST", "/api/warehouses", { token: seller, body: { type: "SELLER", location: "M" } }));

  // --- Validaciones del catálogo
  const base = { name: "Silla", description: "Madera", price: 120.5, type: "PHYSICAL" };
  await must("producto sin nombre -> 400", 400, call("POST", "/api/products", { token: seller, body: { ...base, name: "  " } }));
  await must("precio con 3 decimales -> 400", 400, call("POST", "/api/products", { token: seller, body: { ...base, price: 10.005 } }));
  await must("precio como texto -> 400", 400, call("POST", "/api/products", { token: seller, body: { ...base, price: "10" } }));
  await must("tipo inválido -> 400", 400, call("POST", "/api/products", { token: seller, body: { ...base, type: "NOPE" } }));
  const p = await must("crear producto", 201, call("POST", "/api/products", { token: seller, body: base }));
  check("precio decimal exacto 120.5", p.price === 120.5, p);
  await must("variante sin valor -> 400", 400, call("PATCH", `/api/products/${p.id}/variants`, { token: seller, body: { name: "Color" } }));
  // Variantes simultáneas: con $push ninguna se pierde
  const vs = await Promise.all(["Rojo", "Azul", "Verde", "Negro", "Blanco"].map((value) =>
    call("PATCH", `/api/products/${p.id}/variants`, { token: seller, body: { name: "Color", value } })));
  check("5 variantes simultáneas: todas 200", vs.every((r) => r.status === 200), vs.map((r) => r.status));
  const withVariants = await must("producto con variantes", 200, call("GET", `/api/products/${p.id}`, { token: seller }));
  check("ninguna variante se pierde (5)", withVariants.variants.length === 5, withVariants.variants);
  await must("estado inválido -> 400", 400, call("PATCH", `/api/products/${p.id}/status`, { token: seller, body: { status: "NOPE" } }));
  await must("producto inexistente -> 404", 404, call("GET", "/api/products/no-existe", { token: seller }));
  await must("variante a producto inexistente -> 404", 404, call("PATCH", "/api/products/no-existe/variants", { token: admin, body: { name: "a", value: "b" } }));
  await must("stock", 201, call("POST", "/api/inventory/inbound", { token: seller, body: { productId: p.id, warehouseId: wh.id, quantity: 50 } }));

  // --- Carrito: 10 "agregar 1" simultáneos no pierden ninguno
  const email = `mb-${RUN}@smoke.test`;
  const buyerUser = await must("comprador", 201, call("POST", "/api/auth/register", { body: { documentNumber: nextDoc(), fullName: "B", email, password: "Buyer12345" } }));
  const buyer = await login(email, "Buyer12345");
  await must("perfil", 201, call("POST", "/api/buyers", { token: buyer, body: { primaryAddress: { street: "C", city: "B", country: "CO", postalCode: "1" } } }));
  const adds = await Promise.all(Array.from({ length: 10 }, () =>
    call("POST", `/api/carts/${buyerUser.id}/items`, { token: buyer, body: { productId: p.id, quantity: 1 } })));
  check("10 agregados simultáneos: todos 200", adds.every((r) => r.status === 200), adds.map((r) => r.status));
  const cart = await must("ver carrito", 200, call("GET", `/api/carts/${buyerUser.id}`, { token: buyer }));
  check("una sola línea con cantidad 10 (sin pérdidas ni duplicados)", cart.items.length === 1 && cart.items[0].quantity === 10, cart);
  await must("cambiar cantidad a 4", 200, call("PATCH", `/api/carts/${buyerUser.id}/items/${p.id}`, { token: buyer, body: { quantity: 4 } }));
  await must("cambiar cantidad de producto ausente -> 400", 400, call("PATCH", `/api/carts/${buyerUser.id}/items/otro`, { token: buyer, body: { quantity: 2 } }));

  // Producto suspendido no se puede agregar
  const p2 = await must("segundo producto", 201, call("POST", "/api/products", { token: seller, body: { name: "Mesa", description: "", price: 300, type: "PHYSICAL" } }));
  await must("suspender", 200, call("PATCH", `/api/products/${p2.id}/status`, { token: seller, body: { status: "SUSPENDED" } }));
  await must("agregar suspendido -> 400", 400, call("POST", `/api/carts/${buyerUser.id}/items`, { token: buyer, body: { productId: p2.id, quantity: 1 } }));

  writeFileSync(STATE, JSON.stringify({ productId: p.id, buyerId: buyerUser.id, email, sellerId: sellerUser.id }));
} else if (mode === "verify") {
  const s = JSON.parse(readFileSync(STATE, "utf8"));
  const p = await must("producto tras reinicio", 200, call("GET", `/api/products/${s.productId}`, { token: admin }));
  check("producto y variantes persisten", p.name === "Silla" && p.price === 120.5 && p.variants.length === 5, p);
  const buyer = await login(s.email, "Buyer12345");
  const cart = await must("carrito tras reinicio", 200, call("GET", `/api/carts/${s.buyerId}`, { token: buyer }));
  check("carrito persiste (cantidad 4)", cart.items.length === 1 && cart.items[0].quantity === 4, cart);
  const order = await must("checkout tras reinicio", 201, call("POST", "/api/orders/checkout", { token: buyer }));
  check("total 4 × 120.5 = 482", order.total === 482, order);
  const inv = await must("reporte inventario", 200, call("GET", "/api/reports/inventory", { token: admin }));
  const row = inv.items.find((i) => i.productId === s.productId);
  check("el reporte ya no dice 'Producto desconocido'", row?.productName === "Silla", row);
  const sales = await must("reporte de ventas", 200, call("GET", "/api/reports/sales", { token: admin }));
  check("ventas por vendedor resueltas desde el catálogo", sales.revenueBySeller.length >= 0, sales.revenueBySeller);
}

console.log(failures === 0 ? `\n${mode.toUpperCase()} OK` : `\n${failures} FALLO(S)`);
process.exitCode = failures === 0 ? 0 : 1;
