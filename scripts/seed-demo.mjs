// Carga datos de demostración a través de la API (no toca la base directamente: pasa por todas las reglas de negocio).
//
//   SEED_API_URL=https://tu-api.onrender.com \
//   SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... \
//   SEED_DEMO_PASSWORD=... \
//   npm run seed:demo
//
// - SEED_ADMIN_*: el administrador que el backend crea al arrancar (ADMIN_EMAIL / ADMIN_PASSWORD).
// - SEED_DEMO_PASSWORD: contraseña de todos los usuarios de demostración (mínimo 8 caracteres).
//   Nunca se guarda en el repositorio: el backend es público y cualquiera podría entrar con ella.
//
// Deja la plataforma lista para presentar: 3 vendedores con bodega y catálogo, un vendedor por habilitar,
// una bodega del marketplace, compradores, operador logístico, supervisor y pedidos en todos los estados
// (pendiente de pago, pagado sin envío, en tránsito y entregado con factura, devolución y reembolso).
// Si ya existen los usuarios de demostración, se detiene sin modificar nada.

const API = (process.env.SEED_API_URL ?? "").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "";
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "";

const missing = Object.entries({ SEED_API_URL: API, SEED_ADMIN_EMAIL: ADMIN_EMAIL, SEED_ADMIN_PASSWORD: ADMIN_PASSWORD, SEED_DEMO_PASSWORD: PASSWORD })
  .filter(([, value]) => !value)
  .map(([key]) => key);
if (missing.length > 0) {
  console.error(`Faltan variables: ${missing.join(", ")}. Ver el encabezado de scripts/seed-demo.mjs.`);
  process.exit(1);
}
if (PASSWORD.length < 8) {
  console.error("SEED_DEMO_PASSWORD debe tener al menos 8 caracteres.");
  process.exit(1);
}

async function call(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(`${method} ${path} → ${response.status} ${data?.message ?? ""}`);
    error.status = response.status;
    throw error;
  }
  return data;
}
const login = async (email, password = PASSWORD) => (await call("POST", "/api/auth/login", { body: { email, password } })).token;
const step = (text) => console.log(`• ${text}`);

// Un servicio gratuito dormido tarda en despertar: se espera a que responda antes de empezar
async function waitForApi() {
  for (let attempt = 1; attempt <= 20; attempt++) {
    try {
      const response = await fetch(`${API}/health`);
      if (response.ok) return;
    } catch {
      // aún no responde
    }
    console.log(`Esperando a que la API responda (${attempt}/20)…`);
    await new Promise((resolve) => setTimeout(resolve, 6000));
  }
  throw new Error(`La API no respondió en ${API}/health`);
}

// Todo el trabajo va en main() y termina solo (sin process.exit con conexiones abiertas: en Windows Node puede fallar)
async function main() {
  await waitForApi();
  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

  const existing = await call("GET", "/api/users?search=laura@demo.test", { token: admin });
  if (existing.total > 0) {
    console.log("Ya hay datos de demostración en esta API: no se modificó nada.");
    return;
  }

  // ─── Usuarios y vendedores ─────────────────────────────────────────────────────

  async function createUser(fullName, email, documentNumber, role) {
    return call("POST", "/api/users", { token: admin, body: { fullName, email, documentNumber, password: PASSWORD, role } });
  }

  async function seller(fullName, email, documentNumber, location) {
    const user = await createUser(fullName, email, documentNumber, "SELLER");
    await call("POST", "/api/sellers", { token: admin, body: { userId: user.id } });
    const token = await login(email);
    const warehouse = await call("POST", "/api/warehouses", { token, body: { type: "SELLER", location } });
    return { id: user.id, token, warehouse };
  }

  step("Vendedores con su bodega");
  const nova = await seller("Nova Tecnología", "nova@demo.test", "900100200", "Bogotá - Zona Industrial");
  const casa = await seller("Casa Verde Hogar", "casaverde@demo.test", "900300400", "Medellín - El Poblado");
  const paginas = await seller("Páginas Libres", "paginas@demo.test", "900500600", "Cali - Centro");
  // Para mostrar cómo el administrador habilita un vendedor y le crea su bodega
  await createUser("Vendedor Pendiente", "pendiente@demo.test", "900999111", "SELLER");

  step("Bodega del marketplace");
  await call("POST", "/api/warehouses", { token: admin, body: { type: "MARKETPLACE", location: "Bogotá - Centro de distribución Fontibón" } });

  step("Catálogo con variantes y existencias");
  const catalog = [
    [nova, "Audífonos inalámbricos Aura", "Cancelación de ruido activa, 30 horas de batería y carga rápida USB-C.", 289900, [["Color", "Negro"], ["Color", "Blanco"], ["Color", "Violeta"]], 25],
    [nova, "Teclado mecánico Pulse 75%", "Switches táctiles, retroiluminación RGB y estructura de aluminio.", 349000, [["Switch", "Rojo"], ["Switch", "Marrón"]], 12],
    [nova, "Mouse ergonómico Glide", "Sensor de 16.000 DPI, seis botones programables y diseño vertical.", 159900, [], 40],
    [nova, 'Monitor curvo 27" Horizon', "Panel QHD a 165 Hz, ideal para trabajo y juegos.", 1249000, [], 6],
    [nova, "Parlante portátil Echo", "Resistente al agua, 12 horas de música y sonido 360°.", 199900, [["Color", "Negro"], ["Color", "Azul"]], 15],
    [nova, "Cámara web Lumen 4K", "Enfoque automático y micrófono dual con reducción de ruido.", 419000, [], 0],
    [casa, "Lámpara de mesa Nórdica", "Base de roble y pantalla de lino. Luz cálida regulable.", 189000, [["Acabado", "Roble"], ["Acabado", "Nogal"]], 18],
    [casa, "Set de 4 tazas de cerámica", "Hechas a mano, aptas para microondas y lavavajillas.", 96500, [["Color", "Verde salvia"], ["Color", "Gris piedra"]], 30],
    [casa, "Planta Monstera en maceta", "Monstera deliciosa de 60 cm con maceta de barro.", 129900, [], 9],
    [casa, "Cojín de terciopelo", "Funda removible de terciopelo, relleno hipoalergénico.", 54900, [["Color", "Morado"], ["Color", "Esmeralda"], ["Color", "Negro"]], 50],
    [casa, "Difusor de aromas Calma", "Ultrasónico, con luz ambiental y apagado automático.", 119000, [], 22],
    [paginas, "Cien años de soledad (edición ilustrada)", "Edición de colección con ilustraciones a color.", 98000, [["Formato", "Tapa dura"]], 15],
    [paginas, "Cuaderno de bocetos A4", "120 hojas de papel libre de ácido, 120 g/m².", 32500, [], 60],
    [paginas, "Agenda 2027 de tapa dura", "Semana a la vista, papel de 90 g/m² y cinta separadora.", 45900, [], 35],
  ];
  // Fotos de Wikimedia Commons con licencia libre; autores y licencias en scripts/CREDITOS-IMAGENES.md
  const photos = {
    "Audífonos inalámbricos Aura": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Headphones_1.jpg/960px-Headphones_1.jpg",
    "Teclado mecánico Pulse 75%": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7f/Beautiful_Mechanical_Keyboard.jpg/960px-Beautiful_Mechanical_Keyboard.jpg",
    "Mouse ergonómico Glide": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b5/Delux_M618_vertical_mouse.jpg/960px-Delux_M618_vertical_mouse.jpg",
    "Monitor curvo 27\" Horizon": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/ASUS_curved_monitor_20170603.jpg/960px-ASUS_curved_monitor_20170603.jpg",
    "Parlante portátil Echo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9d/UE_Boom_2.jpg/960px-UE_Boom_2.jpg",
    "Cámara web Lumen 4K": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/55/Webcam_01.jpg/960px-Webcam_01.jpg",
    "Lámpara de mesa Nórdica": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/be/Bedside_Table_Lamp.jpg/960px-Bedside_Table_Lamp.jpg",
    "Set de 4 tazas de cerámica": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1c/Handmade_Ceramic_Mugs_%28made_and_photographed_by_Liina_Potter%29.jpg/960px-Handmade_Ceramic_Mugs_%28made_and_photographed_by_Liina_Potter%29.jpg",
    "Planta Monstera en maceta": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4b/HK_SW_Leaves_with_holes.JPG/960px-HK_SW_Leaves_with_holes.JPG",
    "Cojín de terciopelo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/74/Batik_Kawung_Cushion.jpg/960px-Batik_Kawung_Cushion.jpg",
    "Difusor de aromas Calma": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b5/Aroma_Diffuser.jpg/960px-Aroma_Diffuser.jpg",
    "Cien años de soledad (edición ilustrada)": "https://upload.wikimedia.org/wikipedia/commons/a/a1/Cien_a%C3%B1os_de_soledad.png",
    "Cuaderno de bocetos A4": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/77/Sketchbook%2C_Sketchbook_of_twenty-one_leaves_of_pencil_drawings%2C_1885%E2%80%9386_%28CH_18418323%29.jpg/960px-Sketchbook%2C_Sketchbook_of_twenty-one_leaves_of_pencil_drawings%2C_1885%E2%80%9386_%28CH_18418323%29.jpg",
    "Agenda 2027 de tapa dura": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2a/Agenda_et_crayon.jpg/960px-Agenda_et_crayon.jpg",
  };
  const products = {};
  for (const [owner, name, description, price, variants, stock] of catalog) {
    const product = await call("POST", "/api/products", { token: owner.token, body: { name, description, price, type: "PHYSICAL", imageUrl: photos[name] } });
    for (const [variantName, value] of variants) {
      await call("PATCH", `/api/products/${product.id}/variants`, { token: owner.token, body: { name: variantName, value } });
    }
    if (stock > 0) {
      await call("POST", "/api/inventory/inbound", { token: owner.token, body: { productId: product.id, warehouseId: owner.warehouse.id, quantity: stock } });
    }
    products[name] = { ...product, owner };
  }
  // Fuera del catálogo público, para ver la diferencia entre roles
  await call("PATCH", `/api/products/${products["Cámara web Lumen 4K"].id}/status`, { token: nova.token, body: { status: "SUSPENDED" } });
  await call("PATCH", `/api/products/${products["Difusor de aromas Calma"].id}/status`, { token: casa.token, body: { status: "DISCONTINUED" } });
  // Unidades dañadas para el reporte de inventario
  await call("POST", "/api/inventory/damaged", { token: nova.token, body: { productId: products["Parlante portátil Echo"].id, warehouseId: nova.warehouse.id, quantity: 2 } });

  step("Operador logístico y supervisora");
  await createUser("Andrés Logística", "logistica@demo.test", "800100100", "LOGISTICS_OPERATOR");
  await createUser("Sofía Supervisora", "supervisor@demo.test", "800200200", "SUPERVISOR");
  const operator = await login("logistica@demo.test");

  // ─── Compradores ───────────────────────────────────────────────────────────────

  async function buyer(fullName, email, documentNumber, primaryAddress, additional = []) {
    const user = await call("POST", "/api/auth/register", { body: { fullName, email, documentNumber, password: PASSWORD } });
    const token = await login(email);
    await call("POST", "/api/buyers", { token, body: { primaryAddress } });
    for (const address of additional) await call("PATCH", `/api/buyers/${user.id}/addresses`, { token, body: address });
    return { id: user.id, token };
  }

  step("Compradores con sus direcciones");
  const laura = await buyer(
    "Laura Compradora",
    "laura@demo.test",
    "1020304050",
    { street: "Carrera 7 # 45-12, apto 302", city: "Bogotá", country: "Colombia", postalCode: "110231" },
    [{ street: "Carrera 43A # 1-50, oficina 1201", city: "Medellín", country: "Colombia", postalCode: "050021" }],
  );
  const carlos = await buyer("Carlos Comprador", "carlos@demo.test", "1030405060", {
    street: "Calle 5 # 38-25",
    city: "Cali",
    country: "Colombia",
    postalCode: "760042",
  });

  // ─── Pedidos en todos los estados ──────────────────────────────────────────────

  async function order(who, lines, addressIndex = 0) {
    for (const [name, quantity] of lines) {
      await call("POST", `/api/carts/${who.id}/items`, { token: who.token, body: { productId: products[name].id, quantity } });
    }
    return call("POST", "/api/orders/checkout", { token: who.token, body: { addressIndex } });
  }
  const pay = (who, created) => call("POST", `/api/orders/${created.id}/pay`, { token: who.token });
  async function ship(created, notes) {
    const shipment = await call("POST", "/api/shipments", { token: operator, body: { orderId: created.id } });
    if (notes.transit) await call("PATCH", `/api/shipments/${shipment.id}/status`, { token: operator, body: { status: "IN_TRANSIT", note: notes.transit } });
    if (notes.delivered) await call("PATCH", `/api/shipments/${shipment.id}/status`, { token: operator, body: { status: "DELIVERED", note: notes.delivered } });
    return shipment;
  }
  const invoice = (created) => call("POST", "/api/invoices", { token: admin, body: { orderId: created.id } });

  step("Pedido entregado, facturado y con devoluciones (Laura)");
  const delivered = await order(laura, [["Audífonos inalámbricos Aura", 2], ["Cuaderno de bocetos A4", 2]]);
  await pay(laura, delivered);
  await invoice(delivered);
  await ship(delivered, { transit: "Salió de la bodega de Bogotá en la ruta de la mañana", delivered: "Recibido por la compradora en portería" });
  // Una devolución aprobada (genera reembolso por pagar) y otra esperando la decisión del vendedor
  const approved = await call("POST", "/api/returns", {
    token: laura.token,
    body: { orderId: delivered.id, productId: products["Audífonos inalámbricos Aura"].id, quantity: 1, reason: "Uno de los audífonos no carga." },
  });
  await call("PATCH", `/api/returns/${approved.id}/process`, { token: nova.token, body: { approve: true } });
  await call("POST", "/api/returns", {
    token: laura.token,
    body: { orderId: delivered.id, productId: products["Cuaderno de bocetos A4"].id, quantity: 1, reason: "Llegó con la portada doblada." },
  });

  step("Pedido en tránsito hacia la oficina (Laura)");
  const inTransit = await order(laura, [["Teclado mecánico Pulse 75%", 1], ["Set de 4 tazas de cerámica", 1]], 1);
  await pay(laura, inTransit);
  await invoice(inTransit);
  await ship(inTransit, { transit: "En camino a Medellín con la transportadora" });

  step("Pedido pagado esperando envío (Carlos) y pedido pendiente de pago (Laura)");
  const paid = await order(carlos, [["Lámpara de mesa Nórdica", 1], ["Cien años de soledad (edición ilustrada)", 1]]);
  await pay(carlos, paid);
  await order(laura, [["Planta Monstera en maceta", 1]]);

  console.log(`
  Demo lista en ${API}
    Vendedores: nova@demo.test, casaverde@demo.test, paginas@demo.test (y pendiente@demo.test, por habilitar)
    Compradores: laura@demo.test, carlos@demo.test
    Operador logístico: logistica@demo.test · Supervisora: supervisor@demo.test
    Contraseña de todos: la de SEED_DEMO_PASSWORD
    Pedidos: entregado con factura y devoluciones, en tránsito, pagado sin envío y pendiente de pago`);
}

main().catch((error) => {
  console.error(`No se pudo cargar la demo: ${error.message}`);
  process.exitCode = 1;
});
