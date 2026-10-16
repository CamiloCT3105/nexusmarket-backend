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

## 6. Aprendizajes sobre trabajar con IA

- **La IA acelera, pero el criterio es tuyo.** Varias reglas de negocio se decidieron en conversación; el desarrollador las aprobó o pidió quitarlas.
- **Los mensajes de error son oro.** Pegar el error exacto y el archivo involucrado resuelve casi todo a la primera.
- **Las versiones nuevas rompen cosas.** Dos de los problemas (TypeScript 7 y Express 5) vinieron de que `npm` instaló versiones más recientes de lo esperado. Conviene fijar versiones.
- **Probar cada módulo antes de seguir** evita arrastrar errores y facilita saber dónde está un fallo.
- **Documentar las simplificaciones** (pago simulado, memoria volátil) evita presentar como terminado algo que no lo está.

## 7. Próximos pasos

1. **Base de datos real**, reemplazando los arrays en memoria: solo cambia la capa `repositories`.
2. **Validación de entradas** con una librería (por ejemplo, `zod`) y validación de enums en el body.
3. **Pruebas automatizadas** de servicios y de rutas.
4. **Frontend en React + TypeScript**, en un repositorio separado, consumiendo esta API.
