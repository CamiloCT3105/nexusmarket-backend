// Dirección de entrega del pedido y estado comercial del comprador.
// - El pedido guarda una copia de la dirección elegida al confirmar (principal por defecto).
// - El vendedor no recibe la dirección; el operador logístico sí (es quien despacha).
// - Un comprador con estado comercial RESTRICTED no puede confirmar pedidos.
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3999";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@e2e.test";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "AdminE2E12345";
const RUN = Date.now().toString(36);
let docSeq = 0;
const nextDoc = () => `D${RUN}A${++docSeq}`.toUpperCase();
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

const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

// --- Preparación: vendedor con stock, operador logístico y comprador con dos direcciones
const sellerUser = await must("vendedor", 201, call("POST", "/api/users", { token: admin, body: { documentNumber: nextDoc(), fullName: "V", email: `ca-s-${RUN}@smoke.test`, password: "Seller12345", role: "SELLER" } }));
await must("onboard", 201, call("POST", "/api/sellers", { token: admin, body: { userId: sellerUser.id } }));
const seller = await login(`ca-s-${RUN}@smoke.test`, "Seller12345");
await must("operador", 201, call("POST", "/api/users", { token: admin, body: { documentNumber: nextDoc(), fullName: "L", email: `ca-l-${RUN}@smoke.test`, password: "Logis12345", role: "LOGISTICS_OPERATOR" } }));
const operator = await login(`ca-l-${RUN}@smoke.test`, "Logis12345");
const warehouse = await must("bodega", 201, call("POST", "/api/warehouses", { token: seller, body: { type: "SELLER", location: "Cali" } }));
const product = await must("producto", 201, call("POST", "/api/products", { token: seller, body: { name: `Lámpara ${RUN}`, description: "d", price: 1000, type: "PHYSICAL" } }));
await must("stock", 201, call("POST", "/api/inventory/inbound", { token: seller, body: { productId: product.id, warehouseId: warehouse.id, quantity: 10 } }));

const buyerUser = await must("registro comprador", 201, call("POST", "/api/auth/register", { body: { documentNumber: nextDoc(), fullName: "C", email: `ca-b-${RUN}@smoke.test`, password: "Buyer12345" } }));
const buyer = await login(`ca-b-${RUN}@smoke.test`, "Buyer12345");
const primary = { street: "Calle 1 # 2-3", city: "Bogotá", country: "Colombia", postalCode: "110111" };
const office = { street: "Carrera 50 # 10-20", city: "Medellín", country: "Colombia", postalCode: "050021" };
await must("perfil", 201, call("POST", "/api/buyers", { token: buyer, body: { primaryAddress: primary } }));
await must("dirección adicional", 200, call("PATCH", `/api/buyers/${buyerUser.id}/addresses`, { token: buyer, body: office }));
const addToCart = () => call("POST", `/api/carts/${buyerUser.id}/items`, { token: buyer, body: { productId: product.id, quantity: 1 } });

// --- Dirección por defecto: la principal
await must("agregar al carrito", 200, addToCart());
const order1 = await must("checkout sin elegir dirección", 201, call("POST", "/api/orders/checkout", { token: buyer }));
check("el pedido guarda la dirección principal", JSON.stringify(order1.shippingAddress) === JSON.stringify(primary), order1.shippingAddress);

// --- Dirección elegida: la adicional (índice 1)
await must("agregar al carrito", 200, addToCart());
await must("índice de dirección inexistente -> 400", 400, call("POST", "/api/orders/checkout", { token: buyer, body: { addressIndex: 5 } }));
await must("índice de dirección no entero -> 400", 400, call("POST", "/api/orders/checkout", { token: buyer, body: { addressIndex: "1" } }));
const order2 = await must("checkout con la dirección adicional", 201, call("POST", "/api/orders/checkout", { token: buyer, body: { addressIndex: 1 } }));
check("el pedido guarda la dirección adicional", JSON.stringify(order2.shippingAddress) === JSON.stringify(office), order2.shippingAddress);

// --- Copia: agregar más direcciones después no cambia el pedido
await must("otra dirección adicional", 200, call("PATCH", `/api/buyers/${buyerUser.id}/addresses`, { token: buyer, body: { street: "Nueva 1", city: "Cali", country: "Colombia", postalCode: "760001" } }));
const again = await must("comprador consulta su pedido", 200, call("GET", `/api/orders/${order2.id}`, { token: buyer }));
check("la dirección del pedido no cambia", JSON.stringify(again.shippingAddress) === JSON.stringify(office), again.shippingAddress);

// --- Quién ve la dirección
const forOperator = await must("operador consulta el pedido", 200, call("GET", `/api/orders/${order2.id}`, { token: operator }));
check("el operador logístico ve la dirección de entrega", forOperator.shippingAddress?.city === "Medellín", forOperator);
const forSeller = await must("vendedor consulta el pedido", 200, call("GET", `/api/orders/${order2.id}`, { token: seller }));
check("el vendedor no recibe la dirección de entrega", !("shippingAddress" in forSeller), forSeller);
const sellerList = await must("vendedor lista sus pedidos", 200, call("GET", "/api/orders", { token: seller }));
check("tampoco en el listado del vendedor", sellerList.items.every((order) => !("shippingAddress" in order)), sellerList.items[0]);

// --- Estado comercial: restringido no compra; al quitar la restricción vuelve a poder
await must("agregar al carrito", 200, addToCart());
await must("admin restringe al comprador", 200, call("PATCH", `/api/buyers/${buyerUser.id}/commercial-status`, { token: admin, body: { commercialStatus: "RESTRICTED" } }));
await must("comprador restringido no confirma pedidos -> 403", 403, call("POST", "/api/orders/checkout", { token: buyer }));
const cart = await must("su carrito se conserva", 200, call("GET", `/api/carts/${buyerUser.id}`, { token: buyer }));
check("el carrito no se vació", cart.items.length === 1, cart);
await must("admin quita la restricción", 200, call("PATCH", `/api/buyers/${buyerUser.id}/commercial-status`, { token: admin, body: { commercialStatus: "ACTIVE" } }));
await must("vuelve a poder confirmar", 201, call("POST", "/api/orders/checkout", { token: buyer }));

console.log(failures === 0 ? "\nTodo OK" : `\n${failures} fallas`);
process.exitCode = failures === 0 ? 0 : 1;
