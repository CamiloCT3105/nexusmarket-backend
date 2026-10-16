# Reglas de negocio y permisos

## 1. Reglas generales de la especificación

La especificación funcional define tres reglas generales. Así se implementa cada una:

| Regla | Texto original | Cómo se implementa |
|---|---|---|
| **RG-01** | Toda operación debe ejecutarse por un usuario autenticado. | `app.ts` monta el middleware `authenticate` sobre todo `/api`, salvo `/api/auth` (registro y login). Sin token válido la respuesta es `401`. |
| **RG-02** | Cada usuario tendrá un único rol dentro del sistema. | `User.role` es un único campo (no una lista). Asignar un rol reemplaza el anterior. |
| **RG-03** | Ningún participante podrá administrar información fuera de su rol. | Control en dos niveles: por **rol** en la ruta (`authorize`) y por **propiedad** del recurso (`ownerOrRoles` y verificaciones en los controllers). Con un rol o propietario incorrecto la respuesta es `403`. |

La especificación también establece que **los vendedores no pueden auto-registrarse y son incorporados por el Administrador** (dominio de vendedores). Se implementa con RN-04 y RN-11.

## 2. Reglas de negocio implementadas

Las reglas `RN-xx` son las que el sistema aplica hoy. Varias se desprenden de la lógica del documento pero no están escritas en él; se señalan en la columna **Origen**: *Documento* si la especificación lo indica expresamente, *Diseño* si es una decisión tomada durante la implementación.

### Usuarios y autenticación

| ID | Regla | Origen | Dónde se aplica |
|---|---|---|---|
| RN-01 | El correo electrónico es único. | Documento | `UserService.createUser` |
| RN-02 | Todo usuario nuevo nace en estado `ACTIVE`. | Diseño | `UserService.createUser` |
| RN-03 | La contraseña debe tener al menos 8 caracteres. | Diseño | `AuthService.registerUser` |
| RN-04 | El registro público solo crea usuarios `BUYER`; cualquier rol enviado se ignora. | Documento / Diseño | `AuthService.registerBuyerAccount` |
| RN-05 | Un fallo de login no revela si el correo existe (mensaje genérico). | Diseño | `AuthService.login` |
| RN-06 | Un usuario bloqueado no puede iniciar sesión y sus tokens vigentes dejan de funcionar de inmediato. | Diseño | `AuthService.login`, middleware `authenticate` |
| RN-07 | El rol se lee del estado actual del usuario en cada petición, no del token. | Diseño | middleware `authenticate` |
| RN-08 | Las contraseñas se guardan como hash `scrypt` con sal; nunca en texto plano. | Diseño | `utils/password.ts` |

### Compradores y vendedores

| ID | Regla | Origen | Dónde se aplica |
|---|---|---|---|
| RN-09 | Para tener perfil de comprador, el usuario debe tener rol `BUYER`. | Diseño | `BuyerService.registerBuyer` |
| RN-10 | Un usuario tiene como máximo un perfil de comprador. | Diseño | `BuyerService.registerBuyer` |
| RN-11 | Solo el Administrador incorpora vendedores, y el usuario debe tener rol `SELLER`. | Documento | `sellerRoutes`, `SellerService.onboardSeller` |
| RN-12 | Un usuario tiene como máximo un perfil de vendedor. | Diseño | `SellerService.onboardSeller` |

### Bodegas

| ID | Regla | Origen | Dónde se aplica |
|---|---|---|---|
| RN-13 | Una bodega de tipo `SELLER` debe tener un vendedor existente. | Documento | `WarehouseService.createWarehouse` |
| RN-14 | Una bodega de tipo `MARKETPLACE` no puede tener vendedor. | Documento | `WarehouseService.createWarehouse` |
| RN-15 | Solo las bodegas de tipo `SELLER` pueden vincularse a un vendedor. | Diseño | `WarehouseService.linkToSeller` |
| RN-16 | Un vendedor solo crea bodegas propias de tipo `SELLER`. | Diseño | `WarehouseController.create` |

### Catálogo

| ID | Regla | Origen | Dónde se aplica |
|---|---|---|---|
| RN-17 | El precio de un producto debe ser mayor a cero. | Diseño | `ProductService.createProduct` |
| RN-18 | Un producto solo puede crearlo un vendedor existente. | Diseño | `ProductService.createProduct` |
| RN-19 | Un producto nuevo nace en estado `PUBLISHED`. | Diseño | `ProductService.createProduct` |
| RN-20 | El dueño del producto es quien lo crea (se toma del token). | Diseño | `ProductController.create` |
| RN-21 | Un vendedor solo modifica sus propios productos; el Administrador puede modificar cualquiera. | Diseño | `ProductController` (`canManageProduct`) |

### Inventario

| ID | Regla | Origen | Dónde se aplica |
|---|---|---|---|
| RN-22 | Para ingresar stock, el producto y la bodega deben existir. | Diseño | `InventoryService.registerInbound` |
| RN-23 | Las cantidades de ingreso y de reserva deben ser mayores a cero. | Diseño | `InventoryService` |
| RN-24 | Disponible = total − reservado − dañado. | Documento | `InventoryService.getAvailableQuantity` |
| RN-25 | No se puede reservar más de lo disponible; el stock nunca queda negativo ni se reserva stock dañado. | Documento | `InventoryService.reserveStock` |
| RN-26 | No se puede despachar más de lo reservado. | Diseño | `InventoryService.confirmOutbound` |
| RN-27 | No se puede marcar como dañado más de lo que está sano. | Diseño | `InventoryService.markAsDamaged` |
| RN-28 | Cada operación de inventario queda registrada como movimiento (`INBOUND`, `RESERVE`, `OUTBOUND`, `ADJUSTMENT`, `RETURN`). | Documento | `InventoryService.recordMovement` |
| RN-29 | Un vendedor solo opera y consulta el inventario de sus propias bodegas. | Diseño | `InventoryController` (`canAccessWarehouse`) |
| RN-30 | Reservar, confirmar salida y reingresar por devolución están restringidos al Administrador (son operaciones internas del sistema). | Diseño | `inventoryRoutes` |

### Carrito

| ID | Regla | Origen | Dónde se aplica |
|---|---|---|---|
| RN-31 | Las cantidades del carrito deben ser mayores a cero. | Diseño | `CartService.addItem`, `updateQuantity` |
| RN-32 | Solo se pueden agregar productos `PUBLISHED`. | Diseño | `CartService.addItem` |
| RN-33 | Agregar un producto que ya está en el carrito suma la cantidad; no duplica la línea. | Diseño | `CartService.addItem` |
| RN-34 | El carrito es privado: solo su dueño accede a él. | Diseño | `cartRoutes` (`ownerOrRoles`) |

### Pedidos

| ID | Regla | Origen | Dónde se aplica |
|---|---|---|---|
| RN-35 | Un carrito vacío no genera pedido. | Diseño | `OrderService.checkout` |
| RN-36 | El checkout valida todas las líneas antes de reservar stock (dos fases). | Diseño | `OrderService.checkout` |
| RN-37 | Al hacer checkout, cada producto debe seguir `PUBLISHED`. | Diseño | `OrderService.checkout` |
| RN-38 | Se reserva el stock en la primera bodega del vendedor con disponibilidad suficiente. | Diseño | `OrderService.checkout`, `InventoryService.findWarehouseWithStock` |
| RN-39 | El precio unitario se copia al pedido y no cambia aunque el producto cambie de precio. | Diseño | `OrderService.checkout` |
| RN-40 | Ciclo de estados `PENDING_PAYMENT → PAID → SHIPPED → DELIVERED`; un pedido `DELIVERED` es inmutable. | Documento | `OrderService.changeStatus` |
| RN-41 | Al pasar un pedido a `SHIPPED`, el stock reservado sale del inventario. | Diseño | `OrderService.changeStatus` |
| RN-42 | El comprador de un pedido es el usuario autenticado, no un dato enviado por el cliente. | Diseño | `OrderController.checkout` |
| RN-43 | Solo el dueño de un pedido puede pagarlo. | Diseño | `OrderController.pay` |

### Facturación

| ID | Regla | Origen | Dónde se aplica |
|---|---|---|---|
| RN-44 | Solo se factura un pedido ya pagado. | Diseño | `InvoiceService.generateInvoice` |
| RN-45 | Cada pedido tiene como máximo una factura. | Diseño | `InvoiceService.generateInvoice` |
| RN-46 | El monto de la factura se copia del pedido al emitirla. | Diseño | `InvoiceService.generateInvoice` |

### Logística

| ID | Regla | Origen | Dónde se aplica |
|---|---|---|---|
| RN-47 | Solo se crea envío para pedidos `PAID`, y como máximo uno por pedido. | Diseño | `ShipmentService.createShipment` |
| RN-48 | Ciclo del envío `PREPARING → IN_TRANSIT → DELIVERED`. | Diseño | `ShipmentService.updateStatus` |
| RN-49 | El envío conduce al pedido (`IN_TRANSIT` → `SHIPPED`, `DELIVERED` → `DELIVERED`), actualizando primero el pedido. | Diseño | `ShipmentService.updateStatus` |
| RN-50 | Cada cambio de estado del envío queda en su historial de eventos. | Documento | `ShipmentService.updateStatus` |

### Devoluciones y reembolsos

| ID | Regla | Origen | Dónde se aplica |
|---|---|---|---|
| RN-51 | La cantidad a devolver debe ser mayor a cero y el motivo es obligatorio. | Diseño | `ReturnService.registerReturn` |
| RN-52 | Solo se devuelve de pedidos propios y ya `DELIVERED`. | Diseño | `ReturnService.registerReturn` |
| RN-53 | El producto devuelto debe pertenecer al pedido. | Diseño | `ReturnService.registerReturn` |
| RN-54 | Unidades devolvibles = compradas − (solicitadas o aprobadas); las rechazadas no cuentan. | Diseño | `ReturnService.registerReturn` |
| RN-55 | Solo se procesa una devolución que esté en estado `REQUESTED`. | Diseño | `ReturnService.processReturn` |
| RN-56 | Aprobar una devolución reingresa las unidades a la bodega de origen, genera el reembolso (precio pagado × cantidad) y marca la devolución como `APPROVED`. | Documento / Diseño | `ReturnService.processReturn` |
| RN-57 | Un vendedor solo procesa devoluciones de sus propios productos. | Diseño | `ReturnController` (`canAccessReturn`) |
| RN-58 | El monto de un reembolso debe ser mayor a cero y cada devolución tiene como máximo un reembolso. | Diseño | `RefundService.generateRefund` |
| RN-59 | Ciclo del reembolso `PENDING → COMPLETED`; solo el Administrador lo completa. | Diseño | `RefundService.updateStatus`, `refundRoutes` |
| RN-60 | Un reembolso solo nace de una devolución aprobada (no hay endpoint para crearlo a mano). | Diseño | `RefundService`, `refundRoutes` |

### Reportes

| ID | Regla | Origen | Dónde se aplica |
|---|---|---|---|
| RN-61 | Una venta es un pedido ya pagado; los ingresos del reporte son brutos (sin descontar reembolsos). | Diseño | `ReportService.getSalesReport` |
| RN-62 | Los reportes son de solo lectura y solo para Supervisor y Administrador. | Documento | `reportRoutes` |

## 3. Matriz de permisos por rol

Leyenda: ✅ puede · 🔒 puede solo sobre lo suyo · ❌ no puede.

| Módulo / acción | Visitante | Comprador | Vendedor | Op. Logístico | Supervisor | Admin |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Registrarse e iniciar sesión | ✅ | — | — | — | — | — |
| Crear usuarios con cualquier rol | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Cambiar estado o rol de usuarios | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Ver un usuario | ❌ | 🔒 | 🔒 | 🔒 | ✅ | ✅ |
| Perfil de comprador (crear / direcciones) | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ |
| Estado comercial del comprador | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Incorporar vendedores | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Crear productos | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Modificar productos (variantes / estado) | ❌ | ❌ | 🔒 | ❌ | ❌ | ✅ |
| Consultar catálogo | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear bodegas | ❌ | ❌ | 🔒 | ❌ | ❌ | ✅ |
| Consultar bodegas | ❌ | ❌ | 🔒 | ✅ | ✅ | ✅ |
| Ingresar stock / marcar dañado | ❌ | ❌ | 🔒 | ❌ | ❌ | ✅ |
| Consultar inventario | ❌ | ❌ | 🔒 | ✅ | ✅ | ✅ |
| Reservar / salida / reingreso de inventario | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Carrito | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ |
| Hacer checkout y pagar | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ |
| Consultar pedidos | ❌ | 🔒 | ❌ | ✅ (por id) | ✅ | ✅ |
| Cambiar estado de pedido a mano | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Generar facturas | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Consultar facturas | ❌ | 🔒 | ❌ | ❌ | ✅ | ✅ |
| Crear y actualizar envíos | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Consultar envíos | ❌ | 🔒 | ❌ | ✅ | ✅ | ✅ |
| Solicitar devoluciones | ❌ | 🔒 | ❌ | ❌ | ❌ | ❌ |
| Procesar devoluciones | ❌ | ❌ | 🔒 | ❌ | ❌ | ✅ |
| Consultar devoluciones | ❌ | 🔒 | 🔒 (por id) | ❌ | ✅ | ✅ |
| Completar reembolsos | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Consultar reembolsos | ❌ | 🔒 | ❌ | ❌ | ✅ | ✅ |
| Reportes administrativos | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

**Notas:**

- 🔒 en **"Ver un usuario"** significa que cada rol puede consultar únicamente **su propio** usuario.
- El **carrito** es privado: ni el administrador puede verlo.
- Los reportes consolidados no están disponibles para vendedores: cada uno consulta su negocio a través de sus propios endpoints.
