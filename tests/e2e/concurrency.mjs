// Pruebas de concurrencia del inventario y los pedidos (PostgreSQL)
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
const tally = (statuses) => statuses.reduce((acc, s) => ({ ...acc, [s]: (acc[s] ?? 0) + 1 }), {});
const login = async (email, password) =>
  (await must(`login ${email}`, 200, call("POST", "/api/auth/login", { body: { email, password } }))).token;

const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

// --- Vendedor, bodega y productos
const sellerEmail = `cseller-${RUN}@smoke.test`;
const sellerUser = await must("crear vendedor", 201, call("POST", "/api/users", { token: admin, body: { documentNumber: nextDoc(), fullName: "V", email: sellerEmail, password: "Seller12345", role: "SELLER" } }));
await must("onboard", 201, call("POST", "/api/sellers", { token: admin, body: { userId: sellerUser.id } }));
const seller = await login(sellerEmail, "Seller12345");
const wh = await must("bodega", 201, call("POST", "/api/warehouses", { token: seller, body: { type: "SELLER", location: "Conc" } }));
async function product(name, price, stock) {
  const p = await must(`producto ${name}`, 201, call("POST", "/api/products", { token: seller, body: { name, description: name, price, type: "PHYSICAL" } }));
  await must(`stock ${name}`, 201, call("POST", "/api/inventory/inbound", { token: seller, body: { productId: p.id, warehouseId: wh.id, quantity: stock } }));
  return p;
}
const availability = async (p) => must("disponibilidad", 200, call("GET", `/api/inventory/${p.id}/${wh.id}`, { token: seller }));

let buyerCount = 0;
async function buyerWithCart(items) {
  const email = `cbuyer-${RUN}-${++buyerCount}@smoke.test`;
  const user = await must("registro comprador", 201, call("POST", "/api/auth/register", { body: { documentNumber: nextDoc(), fullName: "C", email, password: "Buyer12345" } }));
  const token = await login(email, "Buyer12345");
  await must("perfil", 201, call("POST", "/api/buyers", { token, body: { primaryAddress: { street: "C", city: "B", country: "CO", postalCode: "1" } } }));
  for (const [p, qty] of items) {
    await must("agregar al carrito", 200, call("POST", `/api/carts/${user.id}/items`, { token, body: { productId: p.id, quantity: qty } }));
  }
  return { id: user.id, token };
}

// 1) Sobreventa: 10 unidades, 5 compradores piden 3 a la vez -> solo 3 pueden comprar
const A = await product("A", 100, 10);
const buyersA = await Promise.all([1, 2, 3, 4, 5].map(() => buyerWithCart([[A, 3]])));
const resA = await Promise.all(buyersA.map((b) => call("POST", "/api/orders/checkout", { token: b.token })));
const tA = tally(resA.map((r) => r.status));
console.log("  sobreventa ->", JSON.stringify(tA));
check("sobreventa: exactamente 3 pedidos creados, 2 rechazados con 400", tA[201] === 3 && tA[400] === 2, tA);
const avA = await availability(A);
check("sobreventa: reservadas 9 de 10, nunca más que el stock", avA.reservedQuantity === 9 && avA.quantity === 10, avA);

// 2) Deadlock y reservas parciales: C y D con 10 c/u; 6 compradores piden 6 de cada uno,
//    la mitad agrega C->D y la otra mitad D->C. Solo un pedido cabe.
const C = await product("C", 10, 10);
const D = await product("D", 20, 10);
const buyersCD = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => buyerWithCart(i % 2 ? [[D, 6], [C, 6]] : [[C, 6], [D, 6]])));
const resCD = await Promise.all(buyersCD.map((b) => call("POST", "/api/orders/checkout", { token: b.token })));
const tCD = tally(resCD.map((r) => r.status));
console.log("  orden cruzado ->", JSON.stringify(tCD));
check("orden cruzado: 1 pedido creado, 5 rechazados, ningún 500 (sin deadlock)", tCD[201] === 1 && tCD[400] === 5 && !tCD[500], tCD);
const [avC, avD] = [await availability(C), await availability(D)];
check("orden cruzado: sin reservas parciales (6 y 6)", avC.reservedQuantity === 6 && avD.reservedQuantity === 6, { avC, avD });
const failedBuyer = buyersCD[resCD.findIndex((r) => r.status === 400)];
const cartKept = await must("carrito del rechazado", 200, call("GET", `/api/carts/${failedBuyer.id}`, { token: failedBuyer.token }));
check("orden cruzado: el carrito del pedido rechazado se conserva", cartKept.items.length === 2, cartKept);

// 3) Doble despacho: dos PATCH SHIPPED simultáneos del mismo pedido
const winner = buyersA[resA.findIndex((r) => r.status === 201)];
const order = resA.find((r) => r.status === 201).data;
await must("pagar", 200, call("POST", `/api/orders/${order.id}/pay`, { token: winner.token }));
const ship = await Promise.all([1, 2].map(() => call("PATCH", `/api/orders/${order.id}/status`, { token: admin, body: { status: "SHIPPED" } })));
const tShip = tally(ship.map((r) => r.status));
console.log("  doble despacho ->", JSON.stringify(tShip));
check("doble despacho: uno 200 y el otro rechazado (409/400)", tShip[200] === 1 && ((tShip[409] ?? 0) + (tShip[400] ?? 0)) === 1, tShip);
const avA2 = await availability(A);
check("doble despacho: el stock sale una sola vez (10 -> 7, reservadas 9 -> 6)", avA2.quantity === 7 && avA2.reservedQuantity === 6, avA2);

// 4) Dinero: DECIMAL sin errores de punto flotante
const E = await product("E", 50.1, 10);
const bE = await buyerWithCart([[E, 3]]);
const oE = await must("checkout E", 201, call("POST", "/api/orders/checkout", { token: bE.token }));
check("total 3 × 50.10 = 150.3 exacto", oE.total === 150.3 && oE.items[0].unitPrice === 50.1, oE);
const oE2 = await must("pedido E leído de la base", 200, call("GET", `/api/orders/${oE.id}`, { token: bE.token }));
check("total persistido como 150.3", oE2.total === 150.3, oE2);

// 5) Validaciones nuevas
await must("cantidad fraccionaria en carrito -> 400", 400, call("POST", `/api/carts/${bE.id}/items`, { token: bE.token, body: { productId: E.id, quantity: 1.5 } }));
await must("ingreso con cantidad fraccionaria -> 400", 400, call("POST", "/api/inventory/inbound", { token: seller, body: { productId: E.id, warehouseId: wh.id, quantity: 2.5 } }));
await must("dañados negativos -> 400", 400, call("POST", "/api/inventory/damaged", { token: seller, body: { productId: E.id, warehouseId: wh.id, quantity: -3 } }));
await must("estado de pedido inválido -> 400", 400, call("PATCH", `/api/orders/${oE.id}/status`, { token: admin, body: { status: "NOPE" } }));
await must("pedido con id mal formado -> 404", 404, call("GET", "/api/orders/abc", { token: admin }));

console.log(failures === 0 ? "\nCONCURRENCIA OK" : `\n${failures} FALLO(S)`);
process.exitCode = failures === 0 ? 0 : 1;
