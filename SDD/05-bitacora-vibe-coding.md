# Bitácora de vibe coding

Este documento registra **cómo se construyó** NexusMarket Backend trabajando junto con un asistente de IA: la metodología, el orden de construcción, los problemas reales que aparecieron y cómo se resolvieron.

> **Nota de honestidad.** Es un resumen reconstruido a partir de la sesión de trabajo. La conversación completa no se versiona en el repositorio; aquí quedan las decisiones y aprendizajes que importan.

## 1. Metodología

El desarrollo se hizo **paso a paso, con revisión humana en cada paso**: la IA propone el código con su explicación, el desarrollador lo escribe en su proyecto, lo prueba con peticiones HTTP y solo entonces se avanza. Nada se dio por bueno sin ejecutarlo.

### Ciclo por módulo

1. **Leer el dominio** en la especificación funcional ([`01`](./01-especificacion-funcional.md)).
2. **Definir el modelo**: interfaces y enums, sin lógica.
3. **Repositorio**: acceso a datos (en memoria).
4. **Servicio**: las reglas de negocio.
5. **Controller y rutas**: traducción a HTTP y permisos.
6. **Conectar** la ruta en `app.ts`.
7. **Probar** con una lista de peticiones: caso feliz **y** casos de error esperados.
8. **Commit y push** del módulo ya probado, en su propia rama.

### Reglas de trabajo que se mantuvieron

- **Explicar antes de pasar al siguiente archivo**: cada pieza de código llegó con su porqué.
- **Señalar lo que no está en el documento.** Cuando la IA agregó una regla que se desprende de la lógica del negocio pero no está escrita (por ejemplo, exigir rol `BUYER` para registrar un comprador), lo dijo explícitamente para que el desarrollador decidiera. Esas reglas están marcadas como *Diseño* en [`04`](./04-reglas-de-negocio-y-permisos.md).
- **Anotar los pendientes en voz alta** en lugar de esconderlos (validación de bodega al asignarla a un vendedor, pago simulado, etc.). Hoy viven en las [limitaciones conocidas](./02-arquitectura-y-decisiones.md#8-limitaciones-conocidas).
- **Probar los casos de error, no solo el feliz.** Cada módulo tiene pruebas de rechazo (stock insuficiente, rol incorrecto, recurso ajeno, transición inválida).
- **Mantener la lógica fuera de los controllers** y las dependencias entre servicios en un solo sentido.

## 2. Plantilla de spec / prompt por módulo

Esta es la estructura que funcionó para pedirle un módulo a la IA. Sirve para retomar el proyecto o para agregar módulos nuevos:

```text
Contexto
- Proyecto: NexusMarket Backend (Node + TypeScript + Express 5, CommonJS, arquitectura por capas).
- Módulo a construir: <nombre>.
- Dependencias existentes: <servicios que ya existen y puede usar>.

Del documento funcional
- Objetivo: <OBJ-xx>.
- Reglas del documento que aplican: <textos literales>.

Pedido
- Modelo: <campos y enums>.
- Repositorio en memoria con: <operaciones>.
- Servicio con las reglas: <lista numerada>.
- Controller y rutas con estos permisos: <rol → endpoint>.

Restricciones
- No acceder a repositorios de otros módulos: usar sus servicios.
- La identidad sale del token, nunca del body.
- Marcar explícitamente cualquier regla que añadas y no esté en el documento.
- Respetar noUncheckedIndexedAccess y exactOptionalPropertyTypes.

Entregable
- Código por archivo, con explicación breve de cada decisión.
- Lista de peticiones HTTP de prueba: caso feliz y casos de error con el código esperado.
```

## 3. Orden de construcción

| Fase | Contenido | Por qué en este orden |
|---|---|---|
| 0 | Repositorio en GitHub, TypeScript, Express, estructura de carpetas, `/health` | Base sobre la que todo se apoya. |
| 1 | **User** | Todos los demás módulos dependen de usuarios. |
| 2 | **Buyer**, **Seller** | Perfiles que extienden a `User` por `userId`. |
| 3 | **Product**, **Warehouse** | Catálogo y ubicaciones; `Product` y `Warehouse` validan contra `Seller`. |
| 4 | **Inventory** | Conecta producto y bodega; contiene las reglas de stock más delicadas. |
| 5 | **Cart**, **Order** | Conecta comprador, producto e inventario; el checkout reserva stock. |
| 6 | **Invoice**, **Shipment** | Se apoyan en pedidos pagados; el envío conduce el estado del pedido. |
| 7 | **Return**, **Refund** | Posventa: devuelve stock y genera el reembolso. |
| 8 | **Autenticación** (registro, login, JWT, middlewares) | Se dejó después del negocio a propósito: la especificación excluye la autenticación técnica del alcance funcional. |
| 9 | **Autorización por rol y propiedad** en todos los módulos; se eliminó el atajo `actingUserRole` | Cierra los atajos temporales y cumple RG-01, RG-02 y RG-03. |
| 10 | **Reportes** | Consolida información de todos los módulos (OBJ-12). |
| 11 | **Documentación** (`README` y `SDD/`) | Deja el proyecto entendible sin leer el código. |
| 12 | **Capas asíncronas y manejo central de errores** | Primer paso hacia la base de datos (PostgreSQL + MongoDB): se cambia la firma de todas las capas sin cambiar el almacenamiento todavía. |
| 13 | **Infraestructura de bases de datos** (Docker, Prisma, esquema SQL, transacciones) y **usuarios + credenciales en PostgreSQL** | Usuarios es el módulo del que dependen todos los demás, igual que en la fase 1. |
| 14 | **Compradores, vendedores y bodegas en PostgreSQL** | Mismo orden que las fases 2 y 3: perfiles y bodegas son la base de inventario y pedidos. |
| 15 | **Inventario y pedidos en PostgreSQL** con checkout transaccional | Es el núcleo del negocio y la parte más sensible a la concurrencia; se apoya en perfiles y bodegas ya migrados. |
| 16 | **Facturas, envíos, devoluciones y reembolsos en PostgreSQL**; **reportes con SQL** | Cierra la parte relacional: posventa depende de pedidos, y los reportes ya pueden agregar todo en la base de datos. |

## 4. Resumen por módulo

| Módulo | Objetivo | Decisiones que se añadieron al documento | Depende de |
|---|---|---|---|
| User / Auth | OBJ-01 | Credenciales separadas con hash `scrypt`; JWT; registro público solo `BUYER`; admin sembrado desde `.env`. | — |
| Buyer | OBJ-03 | Perfil por `userId`; exige rol `BUYER`. | User |
| Seller | OBJ-02 | Solo el administrador incorpora; exige rol `SELLER`. | User |
| Warehouse | OBJ-04 | Reglas condicionales según el tipo de bodega. | Seller |
| Product | OBJ-05 | Precio mayor a cero; nace publicado; dueño tomado del token. | Seller |
| Inventory | OBJ-06 | Separar estado actual (`InventoryItem`) de historial (`InventoryMovement`). | Product, Warehouse |
| Cart | OBJ-07 | Carrito creado al primer uso; no valida stock (se valida en checkout). | Buyer, Product |
| Order | OBJ-08 | Checkout en dos fases; precio copiado al pedido; tabla de transiciones. | Cart, Product, Warehouse, Inventory |
| Invoice | OBJ-09 | Solo pedidos pagados; una por pedido. | Order |
| Shipment | OBJ-10 | Historial de eventos; conduce el estado del pedido. | Order |
| Return / Refund | OBJ-11 | Unidades devolvibles; reembolso solo nace de una devolución aprobada. | Order, Inventory |
| Reports | OBJ-12 | Solo lectura; sin repositorio propio. | Todos |

## 5. Problemas encontrados y cómo se resolvieron

Los errores forman parte del proceso. Estos fueron los reales, en el orden en que aparecieron:

| # | Síntoma | Causa | Solución |
|---|---|---|---|
| 1 | `ECMAScript imports and exports cannot be written in a CommonJS file under 'verbatimModuleSyntax'` | `tsc --init` generó `verbatimModuleSyntax: true`, pensado para ESM, y se había cambiado a CommonJS. | Eliminar `verbatimModuleSyntax` del `tsconfig.json`. |
| 2 | `moduleResolution=node10 is deprecated` | Se declaró `moduleResolution: "node"`, que TypeScript marca como obsoleto. | Quitar `moduleResolution`: con `module: commonjs` se infiere solo. |
| 3 | `process` y otros globales de Node sin tipos | `"types": []` en el `tsconfig` desactiva los tipos globales. | Cambiar a `"types": ["node"]` e instalar `@types/node`. |
| 4 | `Missing script: "dev"` | El `package.json` no tenía los scripts definidos. | Agregar `dev`, `build` y `start`. |
| 5 | `Cannot read properties of undefined (reading 'fileExists')` al correr `npm run dev` | `ts-node` (usado por `ts-node-dev`) aún no es compatible con TypeScript 7. | Bajar a TypeScript 5.x. |
| 6 | `Argument of type 'string \| string[] \| undefined' is not assignable to parameter of type 'string'` | En Express 5, `req.params` puede tipar valores como `string[]`. | Validar con `typeof id !== "string"` antes de usar el parámetro. |
| 7 | `Types of property 'sellerId' are incompatible` con `exactOptionalPropertyTypes` | Pasar `sellerId: undefined` no es lo mismo que omitir la propiedad. | Agregarla condicionalmente: `...(sellerId ? { sellerId } : {})`. |
| 8 | Dependencia circular entre devolución y reembolso (evitada en el diseño) | `ReturnService` y `RefundService` se habrían importado mutuamente. | `RefundService` no conoce a `ReturnService`: recibe el monto ya calculado. |
| 9 | `req.user` no tipado (evitado en el diseño) | Ampliar `Request` con declaraciones globales no funciona bien con `ts-node-dev`. | Pasar el usuario autenticado por `res.locals`. |
| 10 | `WarehouseService.linkToSeller` no guardaba el vendedor de la bodega (encontrado al pasar a `async`) | Mutaba el objeto devuelto por el repositorio sin llamar a `update()`; funcionaba solo porque el array en memoria devolvía la referencia. Con una base de datos el cambio se habría perdido. | Agregar `WarehouseRepository.update` y hacer que los repositorios devuelvan copias, para que este tipo de error aparezca ya. |
| 11 | Códigos HTTP incoherentes: "producto inexistente" respondía `404` en un endpoint y `400` en otro | Cada controller elegía el código en su propio `catch`, sin saber qué tipo de error había ocurrido. | Errores tipados en los servicios y un middleware central (`errorHandler`). |
| 12 | `npm view prisma version` devolvía `8.0.0-rc.34` | El tag `latest` de Prisma apuntaba a una *release candidate*. | Instalar la última estable con versión exacta: `prisma@7.10.1 --save-exact`. |
| 13 | El puerto 27017 ya estaba ocupado | Hay un `mongod` instalado en el equipo. | Publicar el MongoDB de Docker en el puerto 27018. |
| 14 | `Expected 0-1 arguments, but got 2` en `new Error(msg, { cause })` | La opción `cause` es de ES2022 y el proyecto compila a ES2020. | Incluir el detalle del error original en el mensaje. |
| 15 | Riesgo de usuario sin credencial (evitado en el diseño) | El registro hace dos escrituras; si la segunda falla, la primera quedaba guardada. | Envolver ambas en `transaction()`; probado con cuatro registros simultáneos del mismo correo (uno `201`, tres `409`, ningún huérfano). |
| 16 | `GET /warehouses/abc` respondía `500` | Con PostgreSQL, un id que no es UUID hace fallar la consulta (`invalid input syntax for type uuid`). En memoria simplemente no se encontraba. | Los repositorios comprueban el formato (`isUuid`) y responden "no encontrado" → `404`. |
| 17 | Perfil de comprador sin `postalCode` respondía `500` | La columna es obligatoria en la base de datos, pero el body no se validaba; en memoria se guardaba incompleto. | Validar la dirección en `BuyerService` → `400` indicando los campos que faltan. |
| 18 | Una bodega reasignada quedaba en la lista de dos vendedores (encontrado al diseñar la migración) | `Seller.warehouseIds` era una copia de la relación que nadie limpiaba. | Calcular la lista desde `warehouses.seller_id` (D-36). |
| 19 | Riesgo de sobreventa y de reservas parciales en el checkout (resuelto en el diseño) | Leer el stock, comprobar en Node y luego escribir deja una ventana en la que otro pedido se lleva las mismas unidades. | `UPDATE` condicional atómico dentro de una transacción; probado con 5 checkouts simultáneos sobre stock para 3. |
| 20 | Riesgo de interbloqueo (deadlock) entre checkouts (resuelto en el diseño) | Dos pedidos con los mismos productos en distinto orden bloquean filas en orden opuesto; PostgreSQL aborta uno con error. | Reservar siempre en orden fijo (producto + bodega); probado con 6 checkouts cruzados: ningún `500`. |
| 21 | Cantidad `1.5` en el carrito terminaba en `500` al hacer checkout | La columna `quantity` es entera y la validación solo exigía `> 0`. | Validar enteros positivos en carrito e inventario. |
| 22 | Riesgo de dos reembolsos por una misma devolución (resuelto en el diseño) | Dos aprobaciones simultáneas leían `REQUESTED` y ambas reingresaban stock y generaban reembolso. | Transición condicional (`WHERE status = 'REQUESTED'`) dentro de la misma transacción que el reingreso y el reembolso. |
| 23 | Riesgo de devolver más unidades de las compradas (resuelto en el diseño) | Varias solicitudes simultáneas sumaban "lo ya devuelto" antes de que las otras se guardaran. | Bloquear la fila del pedido (`SELECT ... FOR UPDATE`) durante la validación; probado con 3 solicitudes de 2 unidades sobre 3 compradas. |
| 24 | Edición del SDD con un script falló: "texto no encontrado" | Los `.md` usan saltos de línea CRLF y el script buscaba `
`. | Normalizar a LF antes de reemplazar y restaurar CRLF al guardar. |

## 6. Aprendizajes sobre trabajar con IA

- **La IA acelera, pero el criterio es tuyo.** Varias reglas de negocio se decidieron en conversación; el desarrollador las aprobó o pidió quitarlas.
- **Los mensajes de error son oro.** Pegar el error exacto y el archivo involucrado resuelve casi todo a la primera.
- **Las versiones nuevas rompen cosas.** Dos de los problemas (TypeScript 7 y Express 5) vinieron de que `npm` instaló versiones más recientes de lo esperado. Conviene fijar versiones.
- **Probar cada módulo antes de seguir** evita arrastrar errores y facilita saber dónde está un fallo.
- **Documentar las simplificaciones** (pago simulado, memoria volátil) evita presentar como terminado algo que no lo está.

## 7. Próximos pasos

1. **Terminar la migración a base de datos** (usuarios y credenciales ya están en PostgreSQL): perfiles y bodegas; inventario, pedidos y posventa con transacciones; después catálogo, carritos y bitácora en **MongoDB** (Mongoose). Ver `SDD/02`, sección 6.1.
2. **Validación de entradas** con una librería (por ejemplo, `zod`) y validación de enums en el body.
3. **Pruebas automatizadas** de servicios y de rutas.
4. **Frontend en React + TypeScript**, en un repositorio separado, consumiendo esta API.
