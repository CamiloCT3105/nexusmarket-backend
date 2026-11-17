// Posventa y reportes en PostgreSQL: concurrencia, rollback y cifras exactas.
// Requiere base limpia (los reportes se comparan con valores exactos).
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3999";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@e2e.test";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "AdminE2E12345";
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
  if (r.status !== expected) { failures++; console.log(`FAIL [${r.status} != ${expected}] ${label} -> ${JSON.stringify(r.data)}`); }
  return r.data;
}
function check(label, condition, detail) {
  if (!condition) failures++;
  console.log(`${condition ? "OK  " : "FAIL"} ${label}${condition ? "" : " -> " + JSON.stringify(detail)}`);
}
const tally = (rs) => rs.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
const login = async (email, password) =>
  (await must(`login ${email}`, 200, call("POST", "/api/auth/login", { body: { email, password } }))).token;

const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

// --- Preparación
const sellerUser = await must("vendedor", 201, call("POST", "/api/users", { token: admin, body: { documentNumber: nextDoc(), fullName: "V", email: `ps-${RUN}@smoke.test`, password: "Seller12345", role: "SELLER" } }));
await must("onboard", 201, call("POST", "/api/sellers", { token: admin, body: { userId: sellerUser.id } }));
const seller = await login(`ps-${RUN}@smoke.test`, "Seller12345");
await must("logística", 201, call("POST", "/api/users", { token: admin, body: { documentNumber: nextDoc(), fullName: "L", email: `pl-${RUN}@smoke.test`, password: "Logis12345", role: "LOGISTICS_OPERATOR" } }));
const logistics = await login(`pl-${RUN}@smoke.test`, "Logis12345");
const wh = await must("bodega", 201, call("POST", "/api/warehouses", { token: seller, body: { type: "SELLER", location: "PS" } }));
const P = await must("producto", 201, call("POST", "/api/products", { token: seller, body: { name: "Lámpara", description: "x", price: 33.33, type: "PHYSICAL" } }));
await must("stock", 201, call("POST", "/api/inventory/inbound", { token: seller, body: { productId: P.id, warehouseId: wh.id, quantity: 20 } }));
const avail = async () => must("disponibilidad", 200, call("GET", `/api/inventory/${P.id}/${wh.id}`, { token: seller }));

async function buyer(n) {
  const email = `pb-${RUN}-${n}@smoke.test`;
  const user = await must("comprador", 201, call("POST", "/api/auth/register", { body: { documentNumber: nextDoc(), fullName: "B", email, password: "Buyer12345" } }));
  const token = await login(email, "Buyer12345");
  await must("perfil", 201, call("POST", "/api/buyers", { token, body: { primaryAddress: { street: "C", city: "B", country: "CO", postalCode: "1" } } }));
  return { id: user.id, token };
}
async function paidOrder(b, qty) {
  await must("carrito", 200, call("POST", `/api/carts/${b.id}/items`, { token: b.token, body: { productId: P.id, quantity: qty } }));
  const order = await must("checkout", 201, call("POST", "/api/orders/checkout", { token: b.token }));
  await must("pagar", 200, call("POST", `/api/orders/${order.id}/pay`, { token: b.token }));
  return order;
}

const b1 = await buyer(1);
const o1 = await paidOrder(b1, 3); // 3 × 33.33 = 99.99

// 1) Facturas simultáneas del mismo pedido
const inv = await Promise.all([1, 2].map(() => call("POST", "/api/invoices", { token: admin, body: { orderId: o1.id } })));
check("factura doble simultánea: un 201 y un 409", tally(inv)[201] === 1 && tally(inv)[409] === 1, tally(inv));
const invoice = inv.find((r) => r.status === 201).data;
check("monto de factura 99.99 exacto", invoice.amount === 99.99, invoice);

// 2) Envíos simultáneos del mismo pedido
const shp = await Promise.all([1, 2].map(() => call("POST", "/api/shipments", { token: logistics, body: { orderId: o1.id } })));
check("envío doble simultáneo: un 201 y un 409", tally(shp)[201] === 1 && tally(shp)[409] === 1, tally(shp));
const shipment = shp.find((r) => r.status === 201).data;

// 3) Dos cambios simultáneos a IN_TRANSIT: el inventario sale una sola vez
const tr = await Promise.all([1, 2].map(() => call("PATCH", `/api/shipments/${shipment.id}/status`, { token: logistics, body: { status: "IN_TRANSIT", note: "x" } })));
check("en tránsito doble: un 200 y uno rechazado (409)", tally(tr)[200] === 1 && tally(tr)[409] === 1, tally(tr));
const a1 = await avail();
check("stock sale una vez (20 -> 17, reservadas 0)", a1.quantity === 17 && a1.reservedQuantity === 0, a1);
const delivered = await must("entregar", 200, call("PATCH", `/api/shipments/${shipment.id}/status`, { token: logistics, body: { status: "DELIVERED", note: "Recibido" } }));
check("historial con 3 eventos en orden", delivered.events.map((e) => e.status).join(",") === "PREPARING,IN_TRANSIT,DELIVERED", delivered.events);
const o1d = await must("pedido entregado", 200, call("GET", `/api/orders/${o1.id}`, { token: b1.token }));
check("pedido DELIVERED", o1d.status === "DELIVERED", o1d);

// 4) Rollback: el admin desincroniza el pedido; el envío NO debe cambiar si el pedido no puede
const b2 = await buyer(2);
const o2 = await paidOrder(b2, 2);
const s2 = await must("envío 2", 201, call("POST", "/api/shipments", { token: logistics, body: { orderId: o2.id } }));
await must("admin despacha el pedido a mano", 200, call("PATCH", `/api/orders/${o2.id}/status`, { token: admin, body: { status: "SHIPPED" } }));
await must("envío a IN_TRANSIT falla porque el pedido ya está SHIPPED", 400, call("PATCH", `/api/shipments/${s2.id}/status`, { token: logistics, body: { status: "IN_TRANSIT" } }));
const s2after = await must("envío 2 tras el fallo", 200, call("GET", `/api/shipments/${s2.id}`, { token: logistics }));
check("rollback: envío sigue PREPARING con 1 evento", s2after.status === "PREPARING" && s2after.events.length === 1, s2after);

// 5) Devoluciones simultáneas: 3 solicitudes de 2 unidades sobre 3 compradas -> solo 1 cabe
const rr = await Promise.all([1, 2, 3].map(() => call("POST", "/api/returns", { token: b1.token, body: { orderId: o1.id, productId: P.id, quantity: 2, reason: "Defecto" } })));
check("devoluciones simultáneas: 1 creada, 2 rechazadas (400)", tally(rr)[201] === 1 && tally(rr)[400] === 2, tally(rr));
const ret = rr.find((r) => r.status === 201).data;
await must("queda 1 devolvible -> pedir 2 da 400", 400, call("POST", "/api/returns", { token: b1.token, body: { orderId: o1.id, productId: P.id, quantity: 2, reason: "x" } }));

// 6) Dos aprobaciones simultáneas: un solo reembolso y un solo reingreso
const ap = await Promise.all([1, 2].map(() => call("PATCH", `/api/returns/${ret.id}/process`, { token: seller, body: { approve: true } })));
const tAp = tally(ap);
check("aprobación doble: un 200 y uno rechazado (409/400)", tAp[200] === 1 && ((tAp[409] ?? 0) + (tAp[400] ?? 0)) === 1, tAp);
const a2 = await avail();
check("reingreso una sola vez (17 -> 19... menos 2 del pedido 2 = 17)", a2.quantity === 17, a2);
const refund = await must("reembolso", 200, call("GET", `/api/refunds/return/${ret.id}`, { token: b1.token }));
check("reembolso 66.66 (2 × 33.33)", refund.amount === 66.66, refund);
const cp = await Promise.all([1, 2].map(() => call("PATCH", `/api/refunds/${refund.id}/status`, { token: admin, body: { status: "COMPLETED" } })));
check("completar reembolso doble: un 200 y uno rechazado", tally(cp)[200] === 1, tally(cp));

// 7) Pedido pagado sin envío (para logística) y otro pendiente de pago (no es venta)
const b3 = await buyer(3);
const o3 = await paidOrder(b3, 1);
await must("carrito pendiente", 200, call("POST", `/api/carts/${b3.id}/items`, { token: b3.token, body: { productId: P.id, quantity: 4 } }));
await must("checkout sin pagar", 201, call("POST", "/api/orders/checkout", { token: b3.token }));

// 8) Reportes calculados en SQL
const summary = await must("resumen", 200, call("GET", "/api/reports/summary", { token: admin }));
check("resumen: pedidos por estado", JSON.stringify(summary.ordersByStatus) === JSON.stringify({ PENDING_PAYMENT: 1, PAID: 1, SHIPPED: 1, DELIVERED: 1 }), summary.ordersByStatus);
check("resumen: facturado 99.99, 0 devoluciones pendientes", summary.totalInvoicedAmount === 99.99 && summary.pendingReturns === 0, summary);
check("resumen: usuarios por rol", summary.usersByRole.BUYER === 3 && summary.usersByRole.SELLER === 1 && summary.usersByRole.ADMIN === 1, summary.usersByRole);

const sales = await must("ventas", 200, call("GET", "/api/reports/sales", { token: admin }));
// ventas = o1 (99.99) + o2 (66.66) + o3 (33.33) = 199.98 ; 6 unidades ; ticket 66.66
check("ventas: 3 pedidos, 199.98, ticket 66.66", sales.orderCount === 3 && sales.totalRevenue === 199.98 && sales.averageTicket === 66.66, sales);
check("ventas: top producto 6 unidades / 199.98", sales.topProducts[0]?.unitsSold === 6 && sales.topProducts[0]?.revenue === 199.98 && sales.topProducts[0]?.productName === "Lámpara", sales.topProducts);
check("ventas por vendedor", sales.revenueBySeller[0]?.sellerId === sellerUser.id && sales.revenueBySeller[0]?.revenue === 199.98, sales.revenueBySeller);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const future = await must("ventas desde mañana", 200, call("GET", `/api/reports/sales?from=${tomorrow}`, { token: admin }));
check("filtro de fechas: 0 pedidos", future.orderCount === 0 && future.totalRevenue === 0 && future.topProducts.length === 0, future);

const logi = await must("logística", 200, call("GET", "/api/reports/logistics", { token: admin }));
check("logística: envíos por estado", JSON.stringify(logi.shipmentsByStatus) === JSON.stringify({ PREPARING: 1, IN_TRANSIT: 0, DELIVERED: 1 }), logi.shipmentsByStatus);
check("logística: 1 pedido pagado sin envío (o3)", logi.ordersAwaitingShipment.length === 1 && logi.ordersAwaitingShipment[0].orderId === o3.id && logi.ordersAwaitingShipment[0].total === 33.33, logi.ordersAwaitingShipment);

const rep = await must("devoluciones", 200, call("GET", "/api/reports/returns", { token: admin }));
check("devoluciones: 1 aprobada; reembolsos 0 pendientes, 1 completado por 66.66",
  rep.returnsByStatus.APPROVED === 1 && rep.returnsByStatus.REQUESTED === 0 && rep.refundsPending.count === 0 && rep.refundsCompleted.count === 1 && rep.refundsCompleted.amount === 66.66, rep);

const invRep = await must("inventario", 200, call("GET", "/api/reports/inventory?threshold=5", { token: admin }));
check("inventario: 17 unidades, 5 reservadas (o3 pagado + pendiente)", invRep.totalUnits === 17 && invRep.items[0].reservedQuantity === 5, invRep);

// 9) Ids mal formados
for (const path of ["/api/invoices/abc", "/api/shipments/abc", "/api/returns/abc", "/api/refunds/abc"]) {
  await must(`${path} -> 404`, 404, call("GET", path, { token: admin }));
}

console.log(failures === 0 ? "\nPOSVENTA OK" : `\n${failures} FALLO(S)`);
process.exitCode = failures === 0 ? 0 : 1;
