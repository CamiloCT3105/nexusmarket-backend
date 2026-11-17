// Prueba de humo end-to-end contra el servidor en :3999
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3999";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@e2e.test";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "AdminE2E12345";
const RUN = Date.now().toString(36);
// Documento de identidad único por usuario creado en esta corrida
let docSeq = 0;
const nextDoc = () => `D${RUN}${++docSeq}`.toUpperCase();
let failures = 0;

async function call(method, path, { token, body, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined || raw !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

async function expect(label, expected, promise) {
  const r = await promise;
  const ok = r.status === expected;
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} [${r.status}${ok ? "" : " != " + expected}] ${label}${ok ? "" : " -> " + JSON.stringify(r.data)}`);
  return r.data;
}

// --- Auth
const adminLogin = await expect("login admin", 200, call("POST", "/api/auth/login", { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } }));
const admin = adminLogin.token;

const buyerUser = await expect("registro comprador", 201, call("POST", "/api/auth/register", { body: { documentNumber: nextDoc(), fullName: "Comprador", email: `buyer-${RUN}@smoke.test`, password: "Buyer12345" } }));
await expect("registro correo duplicado -> 409", 409, call("POST", "/api/auth/register", { body: { documentNumber: nextDoc(), fullName: "X", email: `buyer-${RUN}@smoke.test`, password: "Buyer12345" } }));
await expect("contraseña corta -> 400", 400, call("POST", "/api/auth/register", { body: { documentNumber: nextDoc(), fullName: "X", email: `x-${RUN}@smoke.test`, password: "123" } }));
await expect("login clave incorrecta -> 401", 401, call("POST", "/api/auth/login", { body: { email: `buyer-${RUN}@smoke.test`, password: "mala-clave" } }));
const buyer = (await expect("login comprador", 200, call("POST", "/api/auth/login", { body: { email: `buyer-${RUN}@smoke.test`, password: "Buyer12345" } }))).token;
await expect("me", 200, call("GET", "/api/auth/me", { token: buyer }));

// --- Errores transversales
await expect("sin token -> 401", 401, call("GET", "/api/products/abc"));
await expect("token basura -> 401", 401, call("GET", "/api/products/abc", { token: "basura" }));
await expect("JSON mal formado -> 400", 400, call("POST", "/api/auth/login", { raw: "{malo" }));
await expect("ruta inexistente -> 404", 404, call("GET", "/api/no-existe", { token: buyer }));
await expect("producto inexistente -> 404", 404, call("GET", "/api/products/no-existe", { token: buyer }));
await expect("comprador crea usuario -> 403", 403, call("POST", "/api/users", { token: buyer, body: {} }));

// --- Perfiles
await expect("perfil comprador", 201, call("POST", "/api/buyers", { token: buyer, body: { primaryAddress: { street: "Calle 1", city: "Bogotá", country: "CO", postalCode: "110111" } } }));
await expect("perfil comprador duplicado -> 409", 409, call("POST", "/api/buyers", { token: buyer, body: { primaryAddress: { street: "Calle 1", city: "Bogotá", country: "CO", postalCode: "110111" } } }));

const sellerUser = await expect("admin crea vendedor", 201, call("POST", "/api/users", { token: admin, body: { documentNumber: nextDoc(), fullName: "Vendedor", email: `seller-${RUN}@smoke.test`, password: "Seller12345", role: "SELLER" } }));
await expect("onboard vendedor", 201, call("POST", "/api/sellers", { token: admin, body: { userId: sellerUser.id } }));
const seller = (await expect("login vendedor", 200, call("POST", "/api/auth/login", { body: { email: `seller-${RUN}@smoke.test`, password: "Seller12345" } }))).token;

await expect("admin crea operador logístico", 201, call("POST", "/api/users", { token: admin, body: { documentNumber: nextDoc(), fullName: "Logística", email: `log-${RUN}@smoke.test`, password: "Logis12345", role: "LOGISTICS_OPERATOR" } }));
const logistics = (await expect("login logística", 200, call("POST", "/api/auth/login", { body: { email: `log-${RUN}@smoke.test`, password: "Logis12345" } }))).token;

// --- Bodega, producto, inventario
const wh = await expect("vendedor crea bodega", 201, call("POST", "/api/warehouses", { token: seller, body: { type: "SELLER", location: "Medellín" } }));
await expect("admin vincula bodega (persistencia de sellerId)", 200, call("PATCH", `/api/warehouses/${wh.id}/link-seller`, { token: admin, body: { sellerId: sellerUser.id } }));
const product = await expect("vendedor crea producto", 201, call("POST", "/api/products", { token: seller, body: { name: "Audífonos", description: "BT", price: 100, type: "PHYSICAL" } }));
await expect("precio 0 -> 400", 400, call("POST", "/api/products", { token: seller, body: { name: "X", description: "X", price: 0, type: "PHYSICAL" } }));
await expect("agregar variante", 200, call("PATCH", `/api/products/${product.id}/variants`, { token: seller, body: { name: "Color", value: "Negro" } }));
await expect("ingreso inventario", 201, call("POST", "/api/inventory/inbound", { token: seller, body: { productId: product.id, warehouseId: wh.id, quantity: 10 } }));
await expect("ingreso a bodega inexistente -> 404", 404, call("POST", "/api/inventory/inbound", { token: admin, body: { productId: product.id, warehouseId: "nope", quantity: 1 } }));

// --- Carrito y pedido
await expect("checkout carrito vacío -> 400", 400, call("POST", "/api/orders/checkout", { token: buyer }));
await expect("agregar al carrito", 200, call("POST", `/api/carts/${buyerUser.id}/items`, { token: buyer, body: { productId: product.id, quantity: 3 } }));
await expect("agregar producto inexistente -> 404", 404, call("POST", `/api/carts/${buyerUser.id}/items`, { token: buyer, body: { productId: "nope", quantity: 1 } }));
const order = await expect("checkout", 201, call("POST", "/api/orders/checkout", { token: buyer }));
const cartAfter = await expect("carrito vacío tras checkout", 200, call("GET", `/api/carts/${buyerUser.id}`, { token: buyer }));
if (cartAfter.items.length !== 0) { failures++; console.log("FAIL carrito no se vació"); }
const avail = await expect("disponibilidad tras reserva", 200, call("GET", `/api/inventory/${product.id}/${wh.id}`, { token: seller }));
if (avail.reservedQuantity !== 3) { failures++; console.log("FAIL reservedQuantity esperado 3, fue", avail.reservedQuantity); }
await expect("factura antes de pagar -> 400", 400, call("POST", "/api/invoices", { token: admin, body: { orderId: order.id } }));
await expect("pagar", 200, call("POST", `/api/orders/${order.id}/pay`, { token: buyer }));
await expect("pagar dos veces -> 400", 400, call("POST", `/api/orders/${order.id}/pay`, { token: buyer }));
await expect("factura", 201, call("POST", "/api/invoices", { token: admin, body: { orderId: order.id } }));
await expect("factura duplicada -> 409", 409, call("POST", "/api/invoices", { token: admin, body: { orderId: order.id } }));

// --- Envío
const shipment = await expect("crear envío", 201, call("POST", "/api/shipments", { token: logistics, body: { orderId: order.id } }));
await expect("saltar a DELIVERED -> 400", 400, call("PATCH", `/api/shipments/${shipment.id}/status`, { token: logistics, body: { status: "DELIVERED" } }));
await expect("en tránsito", 200, call("PATCH", `/api/shipments/${shipment.id}/status`, { token: logistics, body: { status: "IN_TRANSIT" } }));
await expect("entregado", 200, call("PATCH", `/api/shipments/${shipment.id}/status`, { token: logistics, body: { status: "DELIVERED", note: "Recibido" } }));
const delivered = await expect("pedido DELIVERED", 200, call("GET", `/api/orders/${order.id}`, { token: buyer }));
if (delivered.status !== "DELIVERED") { failures++; console.log("FAIL estado pedido", delivered.status); }

// --- Devolución y reembolso
const ret = await expect("solicitar devolución", 201, call("POST", "/api/returns", { token: buyer, body: { orderId: order.id, productId: product.id, quantity: 1, reason: "Defectuoso" } }));
await expect("devolver de más -> 400", 400, call("POST", "/api/returns", { token: buyer, body: { orderId: order.id, productId: product.id, quantity: 5, reason: "X" } }));
await expect("aprobar devolución (vendedor)", 200, call("PATCH", `/api/returns/${ret.id}/process`, { token: seller, body: { approve: true } }));
await expect("procesar dos veces -> 400", 400, call("PATCH", `/api/returns/${ret.id}/process`, { token: seller, body: { approve: true } }));
const refund = await expect("reembolso por devolución", 200, call("GET", `/api/refunds/return/${ret.id}`, { token: buyer }));
if (refund.amount !== 100) { failures++; console.log("FAIL monto reembolso", refund.amount); }
await expect("completar reembolso", 200, call("PATCH", `/api/refunds/${refund.id}/status`, { token: admin, body: { status: "COMPLETED" } }));

// --- Reportes
const summary = await expect("reporte resumen", 200, call("GET", "/api/reports/summary", { token: admin }));
const sales = await expect("reporte ventas", 200, call("GET", "/api/reports/sales", { token: admin }));
await expect("reporte ventas fecha inválida -> 400", 400, call("GET", "/api/reports/sales?from=xx", { token: admin }));
const inv = await expect("reporte inventario", 200, call("GET", "/api/reports/inventory", { token: admin }));
await expect("reporte logística", 200, call("GET", "/api/reports/logistics", { token: admin }));
const rr = await expect("reporte devoluciones", 200, call("GET", "/api/reports/returns", { token: admin }));
console.log("  ventas:", sales.orderCount, "pedido(s), ingreso", sales.totalRevenue, "| facturado", summary.totalInvoicedAmount);
console.log("  inventario:", JSON.stringify(inv.items[0]));
console.log("  reembolsos completados:", JSON.stringify(rr.refundsCompleted));

// --- Bloqueo de cuenta
await expect("admin bloquea comprador", 200, call("PATCH", `/api/users/${buyerUser.id}/status`, { token: admin, body: { status: "BLOCKED" } }));
await expect("token de cuenta bloqueada -> 403", 403, call("GET", "/api/auth/me", { token: buyer }));
await expect("login cuenta bloqueada -> 403", 403, call("POST", "/api/auth/login", { body: { email: `buyer-${RUN}@smoke.test`, password: "Buyer12345" } }));

console.log(failures === 0 ? "\nTODO OK" : `\n${failures} FALLO(S)`);
process.exitCode = failures === 0 ? 0 : 1;
