// Foto del producto (RN-68): URL https opcional al crear, cambio y retiro con PATCH /products/:id/image.
// Solo el vendedor dueño o el administrador pueden cambiarla; todos los que ven el producto la reciben.
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3999";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@e2e.test";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "AdminE2E12345";
const RUN = Date.now().toString(36);
let docSeq = 0;
const nextDoc = () => `I${RUN}M${++docSeq}`.toUpperCase();
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

async function newSeller(tag) {
  const user = await must(`vendedor ${tag}`, 201, call("POST", "/api/users", { token: admin, body: { documentNumber: nextDoc(), fullName: tag, email: `img-${tag}-${RUN}@smoke.test`, password: "Seller12345", role: "SELLER" } }));
  await must(`onboard ${tag}`, 201, call("POST", "/api/sellers", { token: admin, body: { userId: user.id } }));
  return login(`img-${tag}-${RUN}@smoke.test`, "Seller12345");
}
const seller = await newSeller("dueno");
const otherSeller = await newSeller("otro");
await must("registro comprador", 201, call("POST", "/api/auth/register", { body: { documentNumber: nextDoc(), fullName: "C", email: `img-b-${RUN}@smoke.test`, password: "Buyer12345" } }));
const buyer = await login(`img-b-${RUN}@smoke.test`, "Buyer12345");

const PHOTO = "https://images.example.com/productos/lampara.jpg";
const base = { description: "d", price: 1000, type: "PHYSICAL" };
const create = (body) => call("POST", "/api/products", { token: seller, body: { ...base, name: `Foto ${RUN}`, ...body } });

// --- Crear con y sin foto
const withPhoto = await must("crear producto con foto", 201, create({ imageUrl: `  ${PHOTO}  ` }));
check("guarda la URL sin espacios", withPhoto.imageUrl === PHOTO, withPhoto.imageUrl);
const withoutPhoto = await must("crear producto sin foto", 201, create({}));
check("sin foto no trae imageUrl", !("imageUrl" in withoutPhoto), withoutPhoto);
const emptyPhoto = await must("crear con imageUrl vacía = sin foto", 201, create({ imageUrl: "   " }));
check("la URL vacía no se guarda", !("imageUrl" in emptyPhoto), emptyPhoto);

// --- URL inválidas
await must("http (no https) -> 400", 400, create({ imageUrl: "http://images.example.com/a.jpg" }));
await must("texto que no es URL -> 400", 400, create({ imageUrl: "foto de la lámpara" }));
await must("javascript: -> 400", 400, create({ imageUrl: "javascript:alert(1)" }));
await must("data: -> 400", 400, create({ imageUrl: "data:image/png;base64,AAAA" }));
await must("con usuario y contraseña -> 400", 400, create({ imageUrl: "https://u:p@images.example.com/a.jpg" }));
await must("número en vez de texto -> 400", 400, create({ imageUrl: 42 }));
await must("más de 2048 caracteres -> 400", 400, create({ imageUrl: `https://images.example.com/${"a".repeat(2100)}.jpg` }));

// --- Todos los que ven el producto reciben la foto
const asBuyer = await must("comprador consulta el producto", 200, call("GET", `/api/products/${withPhoto.id}`, { token: buyer }));
check("el comprador recibe la foto", asBuyer.imageUrl === PHOTO, asBuyer);
const catalog = await must("catálogo", 200, call("GET", `/api/products?search=${encodeURIComponent(`Foto ${RUN}`)}&pageSize=100`, { token: buyer }));
check("el catálogo incluye la foto", catalog.items.some((p) => p.id === withPhoto.id && p.imageUrl === PHOTO), catalog.items.map((p) => p.imageUrl));

// --- Cambiar y quitar la foto
const image = (id, token, body) => call("PATCH", `/api/products/${id}/image`, { token, body });
const NEW_PHOTO = "https://cdn.example.org/fotos/lampara-2.webp?w=800";
const changed = await must("el dueño agrega foto a un producto que no tenía", 200, image(withoutPhoto.id, seller, { imageUrl: NEW_PHOTO }));
check("queda la foto nueva", changed.imageUrl === NEW_PHOTO, changed.imageUrl);
const removed = await must("el dueño quita la foto con null", 200, image(withPhoto.id, seller, { imageUrl: null }));
check("sin foto después de quitarla", !("imageUrl" in removed), removed);
const persisted = await must("consulta tras quitarla", 200, call("GET", `/api/products/${withPhoto.id}`, { token: buyer }));
check("el retiro persiste", !("imageUrl" in persisted), persisted);
const byAdmin = await must("el administrador cambia la foto", 200, image(withPhoto.id, admin, { imageUrl: PHOTO }));
check("el administrador puede moderar la foto", byAdmin.imageUrl === PHOTO, byAdmin.imageUrl);
await must("PATCH sin imageUrl -> 400", 400, image(withPhoto.id, seller, {}));
await must("PATCH con URL inválida -> 400", 400, image(withPhoto.id, seller, { imageUrl: "ftp://x.example.com/a.jpg" }));

// --- Permisos
await must("otro vendedor no puede cambiar la foto -> 403", 403, image(withPhoto.id, otherSeller, { imageUrl: NEW_PHOTO }));
await must("el comprador no puede cambiar la foto -> 403", 403, image(withPhoto.id, buyer, { imageUrl: NEW_PHOTO }));
await must("sin token -> 401", 401, image(withPhoto.id, undefined, { imageUrl: NEW_PHOTO }));
await must("producto inexistente -> 404", 404, image("no-existe", admin, { imageUrl: NEW_PHOTO }));

console.log(failures === 0 ? "\nFOTOS DE PRODUCTO OK" : `\n${failures} FALLO(S)`);
process.exitCode = failures === 0 ? 0 : 1;
