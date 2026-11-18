# Despliegue de NexusMarket

Guía para publicar la plataforma completa con planes **gratuitos y sin tarjeta**:

| Pieza | Servicio | Qué aloja |
|---|---|---|
| PostgreSQL | [Neon](https://neon.tech) | Usuarios, pedidos, inventario, facturas, envíos, devoluciones |
| MongoDB | [MongoDB Atlas](https://www.mongodb.com/atlas) (M0) | Catálogo, carritos y bitácora de movimientos |
| Backend (esta API) | [Render](https://render.com) | Node.js, configurado con [`render.yaml`](./render.yaml) |
| Frontend | [Vercel](https://vercel.com) | El repositorio [`nexusmarket-frontend`](https://github.com/CamiloCT3105/nexusmarket-frontend), configurado con su `vercel.json` |

Todo en la región **Este de EE. UU. (Virginia)** para que las bases y la API estén cerca entre sí. Tiempo estimado: 30–40 minutos.

> **Importante:** las contraseñas y cadenas de conexión se escriben **solo en los paneles** de cada servicio. Nunca en el repositorio (es público) ni en mensajes.

---

## 1. PostgreSQL en Neon

1. Crea una cuenta en Neon (puedes entrar con GitHub).
2. **New project** → nombre `nexusmarket`, PostgreSQL **17**, región **AWS US East (N. Virginia)**.
3. En el panel del proyecto, **Connect** → desactiva **Connection pooling** (las migraciones de Prisma necesitan la conexión directa) → copia la cadena. Tiene esta forma:

   ```
   postgresql://usuario:clave@ep-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

   Guárdala: es la variable `DATABASE_URL`.

## 2. MongoDB en Atlas

1. Crea una cuenta en MongoDB Atlas.
2. **Create cluster** → plan **M0 (Free)**, proveedor **AWS**, región **N. Virginia (us-east-1)**, nombre `nexusmarket`.
3. **Database Access** → **Add new database user** → usuario `nexus`, contraseña generada (cópiala), rol *Read and write to any database*.
4. **Network Access** → **Add IP address** → **Allow access from anywhere** (`0.0.0.0/0`). Render gratuito no tiene IP fija; la base sigue protegida por usuario y contraseña.
5. **Connect** → **Drivers** → copia la cadena `mongodb+srv://…`, reemplaza `<db_password>` por la contraseña del paso 3 y agrega el nombre de la base **antes** del `?`:

   ```
   mongodb+srv://nexus:clave@nexusmarket.xxxxx.mongodb.net/nexusmarket?retryWrites=true&w=majority
   ```

   Es la variable `MONGO_URL`.

## 3. Backend en Render

1. Crea una cuenta en Render con GitHub y autoriza el acceso al repositorio `nexusmarket-backend`.
2. **New** → **Blueprint** → elige el repositorio. Render lee `render.yaml` y propone el servicio `nexusmarket-api` (plan Free).
3. Completa las variables que pide:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | La cadena de Neon (paso 1) |
   | `MONGO_URL` | La cadena de Atlas (paso 2) |
   | `CORS_ORIGIN` | La URL del frontend. Si aún no la tienes, pon `https://nexusmarket.vercel.app` y la corriges en el paso 5 |
   | `ADMIN_EMAIL` | Correo del administrador inicial |
   | `ADMIN_PASSWORD` | Contraseña **fuerte** del administrador (mínimo 8 caracteres; la API será pública) |
   | `ADMIN_DOCUMENT_NUMBER` | Documento del administrador (5 a 20 letras, números o guiones) |

   `JWT_SECRET` lo genera Render solo; `NODE_ENV`, `NODE_VERSION` y la duración del token ya vienen en el blueprint.
4. **Apply**. El primer despliegue tarda unos minutos: instala, aplica las migraciones en Neon, compila y arranca. Al arrancar crea el administrador.
5. Comprueba que responde: abre `https://nexusmarket-api.onrender.com/health` (o la URL que muestre Render) → debe decir `{"status":"ok"}`.

## 4. Frontend en Vercel

1. Crea una cuenta en Vercel con GitHub.
2. **Add New** → **Project** → importa `nexusmarket-frontend`. Vercel detecta Vite y usa `vercel.json`.
3. En **Environment Variables** agrega `VITE_API_URL` = la URL de Render del paso 3, **sin barra final** (por ejemplo `https://nexusmarket-api.onrender.com`).
4. **Deploy**. Al terminar, copia el dominio de producción (por ejemplo `https://nexusmarket.vercel.app`).

## 5. Conectar el frontend con la API (CORS)

En Render → servicio `nexusmarket-api` → **Environment** → cambia `CORS_ORIGIN` al dominio exacto de Vercel (con `https://`, sin barra final) → **Save changes**. Render redespliega solo.

Para permitir más de un origen, sepáralos con coma: `https://nexusmarket.vercel.app,http://localhost:5173`. Las vistas previas de Vercel tienen otra URL; si quieres probarlas, agrégalas igual.

## 6. Cargar los datos de demostración

Desde tu computador, en la carpeta de este repositorio (con `npm install` hecho), en PowerShell:

```powershell
$env:SEED_API_URL = "https://nexusmarket-api.onrender.com"
$env:SEED_ADMIN_EMAIL = "<ADMIN_EMAIL de Render>"
$env:SEED_ADMIN_PASSWORD = "<ADMIN_PASSWORD de Render>"
$env:SEED_DEMO_PASSWORD = "<contraseña para los usuarios de demostración>"
npm run seed:demo
```

El script espera a que la API despierte, carga todo a través de la API (respetando las reglas de negocio) y muestra los usuarios creados. Si ya hay datos de demostración, no modifica nada. Detalle de lo que crea: encabezado de [`scripts/seed-demo.mjs`](./scripts/seed-demo.mjs).

Usuarios (todos con `SEED_DEMO_PASSWORD`): `laura@demo.test` y `carlos@demo.test` (compradores), `nova@demo.test`, `casaverde@demo.test`, `paginas@demo.test` (vendedores), `pendiente@demo.test` (vendedor por habilitar), `logistica@demo.test` (operador logístico) y `supervisor@demo.test`.

## 7. Antes de una presentación

- **Despierta la API** 2–3 minutos antes: el plan gratuito de Render la duerme tras 15 minutos sin uso y tarda cerca de un minuto en volver. Abre `/health` o entra al frontend (muestra un aviso mientras despierta).
- Opcional: un monitor gratuito (por ejemplo UptimeRobot) que llame a `/health` cada 10 minutos la mantiene despierta; cabe en las 750 horas mensuales gratuitas.

## Actualizaciones

Cada merge a `main` se publica solo: Render redespliega el backend (y aplica migraciones nuevas) y Vercel el frontend. Si cambias variables de entorno, Render redespliega al guardarlas; en Vercel hay que **Redeploy** porque `VITE_API_URL` se fija al compilar.

## Problemas comunes

| Síntoma | Causa probable |
|---|---|
| El despliegue de Render falla en `npm run build` con tipos de Express | Se quitó `--include=dev` del comando de build (con `NODE_ENV=production`, `npm ci` omite TypeScript). |
| `No se pudo conectar a PostgreSQL` | `DATABASE_URL` con la conexión *pooled* o sin `?sslmode=require`. |
| `No se pudo conectar a MongoDB` | Falta `0.0.0.0/0` en Network Access de Atlas, contraseña con caracteres especiales sin codificar, o falta `/nexusmarket` en la URL. |
| El navegador muestra error de CORS | `CORS_ORIGIN` no coincide exactamente con el dominio de Vercel (revisa `https://` y la barra final). |
| El login tarda casi un minuto | La API estaba dormida (plan gratuito). Es normal la primera vez. |
| El frontend llama a `localhost:3000` | Falta `VITE_API_URL` en Vercel o no se hizo **Redeploy** después de agregarla. |
