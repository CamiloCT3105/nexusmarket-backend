// Preparación para el frontend: documento de identidad, operador logístico en inventario,
// catálogo con filtros y listados paginados con su visibilidad por rol.
// Los datos de esta corrida llevan la etiqueta RUN para aislarlos de otras suites.
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3999";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@e2e.test";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "AdminE2E12345";
const RUN = Date.now().toString(36);
let docSeq = 0;
const nextDoc = () => `L${RUN}${++docSeq}`.toUpperCase();
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
const ids = (page) => page.items.map((x) => x.id);
const isPage = (p) => p && Array.isArray(p.items) && ["page", "pageSize", "total", "totalPages"].every((k) => typeof p[k] === "number");

const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

// ─── 1. Documento de identidad (validación crítica de la especificación) ───────

const reg = (body) => call("POST", "/api/auth/register", { body: { fullName: "Doc", password: "Buyer12345", ...body } });
await must("registro sin documento -> 400", 400, reg({ email: `nodoc-${RUN}@e2e.test` }));
await must("documento muy corto -> 400", 400, reg({ email: `short-${RUN}@e2e.test`, documentNumber: "12" }));
await must("documento con símbolos -> 400", 400, reg({ email: `sym-${RUN}@e2e.test`, documentNumber: "12$45#78" }));
await must("nombre vacío -> 400", 400, reg({ fullName: "  ", email: `noname-${RUN}@e2e.test`, documentNumber: nextDoc() }));
await must("correo inválido -> 400", 400, reg({ email: "no-es-correo", documentNumber: nextDoc() }));

const docDigits = String(Date.now()).slice(-9);
const dotted = `${docDigits.slice(0, 3)}.${docDigits.slice(3, 6)}.${docDigits.slice(6)}`;
const mixedEmail = `Mixed.Case-${RUN}@E2E.Test`;
const b1user = await must("registro con documento con puntos y correo en mayúsculas", 201, reg({ email: mixedEmail, documentNumber: dotted }));
check("documento normalizado (sin puntos)", b1user.documentNumber === docDigits, b1user);
check("correo guardado en minúsculas", b1user.email === mixedEmail.toLowerCase(), b1user);
await must("mismo documento sin puntos, otro correo -> 409", 409, reg({ email: `dup-doc-${RUN}@e2e.test`, documentNumber: docDigits }));
await must("mismo correo con otras mayúsculas -> 409", 409, reg({ email: mixedEmail.toUpperCase(), documentNumber: nextDoc() }));
const b1 = await login(mixedEmail.toUpperCase(), "Buyer12345"); // login sin distinguir mayúsculas
await must("admin crea usuario sin documento -> 400", 400, call("POST", "/api/users", { token: admin, body: { fullName: "X", email: `x-${RUN}@e2e.test`, password: "Seller12345", role: "SELLER" } }));
await must("admin crea usuario con documento repetido -> 409", 409, call("POST", "/api/users", { token: admin, body: { fullName: "X", email: `x2-${RUN}@e2e.test`, password: "Seller12345", role: "SELLER", documentNumber: docDigits } }));
await must("estado de usuario inválido -> 400", 400, call("PATCH", `/api/users/${b1user.id}/status`, { token: admin, body: { status: "NOPE" } }));
await must("rol inválido -> 400", 400, call("PATCH", `/api/users/${b1user.id}/role`, { token: admin, body: { role: "NOPE" } }));

// ─── Actores ───────────────────────────────────────────────────────────────────

async function staff(prefix, role) {
  const email = `${prefix}-${RUN}@e2e.test`;
  const user = await must(`crear ${role}`, 201, call("POST", "/api/users", { token: admin, body: { fullName: `${prefix} ${RUN}`, email, password: "Staff12345", role, documentNumber: nextDoc() } }));
  if (role === "SELLER") await must("onboard", 201, call("POST", "/api/sellers", { token: admin, body: { userId: user.id } }));
  return { id: user.id, token: await login(email, "Staff12345") };
}
const s1 = await staff("ls1", "SELLER");
const s2 = await staff("ls2", "SELLER");
const s3 = await staff("ls3", "SELLER"); // sin productos
const logi = await staff("llog", "LOGISTICS_OPERATOR");
const sup = await staff("lsup", "SUPERVISOR");
async function buyerProfile(token, id) {
  await must("perfil comprador", 201, call("POST", "/api/buyers", { token, body: { primaryAddress: { street: "C", city: "B", country: "CO", postalCode: "1" } } }));
  return { id, token };
}
const buyer1 = await buyerProfile(b1, b1user.id);
const b2user = await must("comprador 2", 201, reg({ email: `lb2-${RUN}@e2e.test`, documentNumber: nextDoc() }));
const buyer2 = await buyerProfile(await login(`lb2-${RUN}@e2e.test`, "Buyer12345"), b2user.id);

// ─── Listado de usuarios ───────────────────────────────────────────────────────

const sellersPage = await must("admin lista vendedores", 200, call("GET", `/api/users?role=SELLER&search=${RUN}&pageSize=2`, { token: admin }));
check("formato de página { items, page, pageSize, total, totalPages }", isPage(sellersPage), sellersPage);
check("filtro por rol + búsqueda: 3 vendedores, 2 por página, 2 páginas", sellersPage.total === 3 && sellersPage.items.length === 2 && sellersPage.totalPages === 2, sellersPage);
const page2 = await must("segunda página", 200, call("GET", `/api/users?role=SELLER&search=${RUN}&pageSize=2&page=2`, { token: admin }));
check("la segunda página trae el restante", page2.items.length === 1 && !ids(sellersPage).includes(page2.items[0].id), page2);
const byDoc = await must("buscar por documento", 200, call("GET", `/api/users?search=${docDigits}`, { token: sup.token }));
check("supervisor encuentra al usuario por documento", byDoc.total === 1 && byDoc.items[0].id === b1user.id, byDoc);
await must("comprador no lista usuarios -> 403", 403, call("GET", "/api/users", { token: b1 }));
await must("pageSize > 100 -> 400", 400, call("GET", "/api/users?pageSize=500", { token: admin }));
await must("page = 0 -> 400", 400, call("GET", "/api/users?page=0", { token: admin }));
await must("rol inexistente en filtro -> 400", 400, call("GET", "/api/users?role=NOPE", { token: admin }));

// ─── Bodegas, stock y 2. operador logístico en inventario ──────────────────────

const wh1 = await must("bodega S1", 201, call("POST", "/api/warehouses", { token: s1.token, body: { type: "SELLER", location: `W1 ${RUN}` } }));
const wh2 = await must("bodega S2", 201, call("POST", "/api/warehouses", { token: s2.token, body: { type: "SELLER", location: `W2 ${RUN}` } }));
const product = async (seller, name, price, type = "PHYSICAL") =>
  must(`producto ${name}`, 201, call("POST", "/api/products", { token: seller.token, body: { name: `${name} ${RUN}`, description: "", price, type } }));
const cafe = await product(s1, "Café Premium", 20);
const libro = await product(s1, "Libro", 15, "DIGITAL");
const camara = await product(s1, "Cámara", 300);
const suave = await product(s2, "Café Suave", 10);
await must("S1 suspende la cámara", 200, call("PATCH", `/api/products/${camara.id}/status`, { token: s1.token, body: { status: "SUSPENDED" } }));

await must("operador logístico ingresa stock en bodega de S1", 201, call("POST", "/api/inventory/inbound", { token: logi.token, body: { productId: cafe.id, warehouseId: wh1.id, quantity: 10 } }));
await must("operador logístico marca unidades dañadas", 200, call("POST", "/api/inventory/damaged", { token: logi.token, body: { productId: cafe.id, warehouseId: wh1.id, quantity: 1 } }));
await must("S2 no puede ingresar stock en bodega de S1 -> 403", 403, call("POST", "/api/inventory/inbound", { token: s2.token, body: { productId: cafe.id, warehouseId: wh1.id, quantity: 1 } }));
await must("comprador no puede ingresar stock -> 403", 403, call("POST", "/api/inventory/inbound", { token: b1, body: { productId: cafe.id, warehouseId: wh1.id, quantity: 1 } }));
await must("stock Café Suave", 201, call("POST", "/api/inventory/inbound", { token: s2.token, body: { productId: suave.id, warehouseId: wh2.id, quantity: 10 } }));
await must("stock Libro", 201, call("POST", "/api/inventory/inbound", { token: s1.token, body: { productId: libro.id, warehouseId: wh1.id, quantity: 5 } }));

// ─── Catálogo ──────────────────────────────────────────────────────────────────

const catalog = (token, query) => call("GET", `/api/products?search=${RUN}${query ? "&" + query : ""}`, { token });
const pub = await must("comprador ve el catálogo", 200, catalog(b1));
check("comprador: 3 publicados, la cámara suspendida no aparece", pub.total === 3 && !ids(pub).includes(camara.id), ids(pub));
await must("comprador pidiendo suspendidos -> 403", 403, catalog(b1, "status=SUSPENDED"));
const digital = await must("filtro por tipo", 200, catalog(b1, "type=DIGITAL"));
check("type=DIGITAL: solo el libro", digital.total === 1 && digital.items[0].id === libro.id, ids(digital));
const range = await must("rango de precio", 200, catalog(b1, "minPrice=12&maxPrice=25"));
check("precio entre 12 y 25: café premium y libro", range.total === 2 && ids(range).includes(cafe.id) && ids(range).includes(libro.id), ids(range));
const asc = await must("orden por precio ascendente", 200, catalog(b1, "sort=price_asc"));
check("orden 10, 15, 20", asc.items.map((p) => p.price).join(",") === "10,15,20", asc.items.map((p) => p.price));
const byName = await must("orden alfabético", 200, catalog(b1, "sort=name_asc"));
check("orden por nombre sin distinguir tildes", byName.items.map((p) => p.name.split(" ")[0]).join(",") === "Café,Café,Libro", byName.items.map((p) => p.name));
const bySeller = await must("filtro por vendedor", 200, catalog(b1, `sellerId=${s2.id}`));
check("sellerId=S2: solo Café Suave", bySeller.total === 1 && bySeller.items[0].id === suave.id, ids(bySeller));
const paged = await must("paginación del catálogo", 200, catalog(b1, "pageSize=2&page=2&sort=price_asc"));
check("página 2 de 2 con el producto más caro", paged.totalPages === 2 && paged.items.length === 1 && paged.items[0].id === cafe.id, paged);
const own = await must("S1 ve su catálogo", 200, catalog(s1.token));
check("vendedor: publicados + los suyos suspendidos (4)", own.total === 4 && ids(own).includes(camara.id), ids(own));
const other = await must("S2 ve el catálogo", 200, catalog(s2.token));
check("otro vendedor NO ve la cámara suspendida de S1", other.total === 3 && !ids(other).includes(camara.id), ids(other));
const susp = await must("admin filtra suspendidos", 200, catalog(admin, "status=SUSPENDED"));
check("admin: status=SUSPENDED -> la cámara", susp.total === 1 && susp.items[0].id === camara.id, ids(susp));
await must("minPrice > maxPrice -> 400", 400, catalog(b1, "minPrice=50&maxPrice=10"));
await must("orden inexistente -> 400", 400, catalog(b1, "sort=random"));
await must("precio negativo -> 400", 400, catalog(b1, "minPrice=-1"));
await must("búsqueda con caracteres especiales no rompe (200)", 200, call("GET", "/api/products?search=(.*", { token: b1 }));

// ─── 3. Pedidos según el rol ───────────────────────────────────────────────────

await must("carrito: café premium", 200, call("POST", `/api/carts/${buyer1.id}/items`, { token: buyer1.token, body: { productId: cafe.id, quantity: 1 } }));
await must("carrito: café suave x2", 200, call("POST", `/api/carts/${buyer1.id}/items`, { token: buyer1.token, body: { productId: suave.id, quantity: 2 } }));
const order = await must("checkout con productos de 2 vendedores", 201, call("POST", "/api/orders/checkout", { token: buyer1.token }));
await must("pagar", 200, call("POST", `/api/orders/${order.id}/pay`, { token: buyer1.token }));

const mine = await must("comprador lista sus pedidos", 200, call("GET", "/api/orders", { token: buyer1.token }));
check("comprador 1 ve su pedido", mine.total === 1 && mine.items[0].id === order.id, mine);
const theirs = await must("comprador 2 lista sus pedidos", 200, call("GET", "/api/orders", { token: buyer2.token }));
check("comprador 2 no ve pedidos ajenos", theirs.total === 0, theirs);
await must("comprador pide pedidos de otro comprador -> 403", 403, call("GET", `/api/orders?buyerId=${buyer1.id}`, { token: buyer2.token }));
const s1orders = await must("S1 lista pedidos con sus productos", 200, call("GET", "/api/orders", { token: s1.token }));
const s1view = s1orders.items.find((o) => o.id === order.id);
check("S1 ve el pedido solo con su línea y subtotal 20", s1orders.total === 1 && s1view?.items.length === 1 && s1view.items[0].productId === cafe.id && s1view.sellerSubtotal === 20, s1view);
const s2orders = await must("S2 lista pedidos con sus productos", 200, call("GET", "/api/orders", { token: s2.token }));
check("S2 ve solo su línea (2 × 10 = 20)", s2orders.items[0]?.items.length === 1 && s2orders.items[0].items[0].productId === suave.id && s2orders.items[0].sellerSubtotal === 20, s2orders.items[0]);
const s1detail = await must("S1 consulta el detalle", 200, call("GET", `/api/orders/${order.id}`, { token: s1.token }));
check("detalle para S1 también filtrado", s1detail.items.length === 1 && s1detail.sellerSubtotal === 20, s1detail);
await must("vendedor sin productos en el pedido -> 403", 403, call("GET", `/api/orders/${order.id}`, { token: s3.token }));
const s3orders = await must("vendedor sin productos lista pedidos", 200, call("GET", "/api/orders", { token: s3.token }));
check("vendedor sin productos: 0 pedidos", s3orders.total === 0, s3orders);
const paidAdmin = await must("admin filtra pedidos pagados del comprador", 200, call("GET", `/api/orders?status=PAID&buyerId=${buyer1.id}`, { token: admin }));
check("admin ve el pedido completo (2 líneas, total 40)", paidAdmin.total === 1 && paidAdmin.items[0].items.length === 2 && paidAdmin.items[0].total === 40, paidAdmin.items[0]);
await must("operador logístico lista pedidos", 200, call("GET", "/api/orders?status=PAID", { token: logi.token }));
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const future = await must("pedidos desde mañana", 200, call("GET", `/api/orders?from=${tomorrow}`, { token: buyer1.token }));
check("filtro de fechas: 0", future.total === 0, future);
await must("fecha inválida -> 400", 400, call("GET", "/api/orders?from=ayer", { token: admin }));

// ─── Bodegas, envíos, facturas, devoluciones, reembolsos e inventario ──────────

const whs = await must("admin lista bodegas de S1", 200, call("GET", `/api/warehouses?sellerId=${s1.id}`, { token: admin }));
check("bodegas de S1: 1", whs.total === 1 && whs.items[0].id === wh1.id, whs);
await must("operador logístico lista bodegas", 200, call("GET", "/api/warehouses?type=SELLER", { token: logi.token }));
await must("vendedor no lista todas las bodegas -> 403", 403, call("GET", "/api/warehouses", { token: s1.token }));

const shipment = await must("crear envío", 201, call("POST", "/api/shipments", { token: logi.token, body: { orderId: order.id } }));
const preparing = await must("logística lista envíos en preparación", 200, call("GET", "/api/shipments?status=PREPARING&pageSize=100", { token: logi.token }));
check("el envío aparece en PREPARING", ids(preparing).includes(shipment.id), preparing.total);
await must("comprador no lista envíos -> 403", 403, call("GET", "/api/shipments", { token: b1 }));

await must("generar factura", 201, call("POST", "/api/invoices", { token: admin, body: { orderId: order.id } }));
const inv1 = await must("comprador lista sus facturas", 200, call("GET", "/api/invoices", { token: buyer1.token }));
check("comprador 1: 1 factura por 40", inv1.total === 1 && inv1.items[0].amount === 40, inv1);
const inv2 = await must("comprador 2 lista facturas", 200, call("GET", "/api/invoices", { token: buyer2.token }));
check("comprador 2: 0 facturas", inv2.total === 0, inv2);
await must("vendedor no lista facturas -> 403", 403, call("GET", "/api/invoices", { token: s1.token }));

await must("en tránsito", 200, call("PATCH", `/api/shipments/${shipment.id}/status`, { token: logi.token, body: { status: "IN_TRANSIT" } }));
await must("entregado", 200, call("PATCH", `/api/shipments/${shipment.id}/status`, { token: logi.token, body: { status: "DELIVERED" } }));
const ret = await must("devolución del café premium", 201, call("POST", "/api/returns", { token: buyer1.token, body: { orderId: order.id, productId: cafe.id, quantity: 1, reason: "Llegó abierto" } }));
const r1 = await must("S1 lista devoluciones de sus productos", 200, call("GET", "/api/returns?status=REQUESTED", { token: s1.token }));
check("S1 ve la devolución para procesarla", r1.total === 1 && r1.items[0].id === ret.id, r1);
const r2 = await must("S2 lista devoluciones", 200, call("GET", "/api/returns", { token: s2.token }));
check("S2 no ve devoluciones de productos ajenos", r2.total === 0, r2);
const rb1 = await must("comprador lista sus devoluciones", 200, call("GET", "/api/returns", { token: buyer1.token }));
check("comprador 1: 1 devolución", rb1.total === 1, rb1);
const rb2 = await must("comprador 2 lista devoluciones", 200, call("GET", "/api/returns", { token: buyer2.token }));
check("comprador 2: 0 devoluciones", rb2.total === 0, rb2);
await must("operador logístico no lista devoluciones -> 403", 403, call("GET", "/api/returns", { token: logi.token }));

await must("S1 aprueba la devolución", 200, call("PATCH", `/api/returns/${ret.id}/process`, { token: s1.token, body: { approve: true } }));
const rf1 = await must("comprador lista sus reembolsos", 200, call("GET", "/api/refunds", { token: buyer1.token }));
check("comprador 1: 1 reembolso de 20", rf1.total === 1 && rf1.items[0].amount === 20, rf1);
const rf2 = await must("comprador 2 lista reembolsos", 200, call("GET", "/api/refunds", { token: buyer2.token }));
check("comprador 2: 0 reembolsos", rf2.total === 0, rf2);
const pending = await must("admin lista reembolsos pendientes", 200, call("GET", "/api/refunds?status=PENDING&pageSize=100", { token: admin }));
check("el reembolso aparece pendiente", pending.items.some((r) => r.returnId === ret.id), pending.total);
await must("vendedor no lista reembolsos -> 403", 403, call("GET", "/api/refunds", { token: s1.token }));

const invS1 = await must("S1 lista su inventario", 200, call("GET", "/api/inventory", { token: s1.token }));
check("S1 solo ve filas de su bodega (café y libro)", invS1.total === 2 && invS1.items.every((i) => i.warehouseId === wh1.id), invS1.items);
const invS1other = await must("S1 filtra por bodega ajena", 200, call("GET", `/api/inventory?warehouseId=${wh2.id}`, { token: s1.token }));
check("bodega ajena: 0 filas", invS1other.total === 0, invS1other);
const invLogi = await must("operador logístico filtra por producto", 200, call("GET", `/api/inventory?productId=${cafe.id}`, { token: logi.token }));
check("café premium: 10 ingresadas − 1 vendida + 1 devuelta = 10, 1 dañada", invLogi.total === 1 && invLogi.items[0].quantity === 10 && invLogi.items[0].damagedQuantity === 1, invLogi.items[0]);
await must("comprador no lista inventario -> 403", 403, call("GET", "/api/inventory", { token: b1 }));

console.log(failures === 0 ? "\nLISTADOS OK" : `\n${failures} FALLO(S)`);
process.exitCode = failures === 0 ? 0 : 1;
