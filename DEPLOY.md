# Guía de despliegue

Este documento describe cómo publicar NexusMarket completo utilizando servicios con plan gratuito, sin necesidad de tarjeta de crédito.

| Componente | Servicio | Contenido |
|---|---|---|
| PostgreSQL | [Neon](https://neon.tech) | Usuarios, pedidos, inventario, facturas, envíos y devoluciones |
| MongoDB | [MongoDB Atlas](https://www.mongodb.com/atlas) (M0) | Catálogo, carritos y bitácora de movimientos |
| API | [Render](https://render.com) | Este repositorio, configurado con [`render.yaml`](./render.yaml) |
| Frontend | [Vercel](https://vercel.com) | Repositorio [`nexusmarket-frontend`](https://github.com/CamiloCT3105/nexusmarket-frontend), configurado con su `vercel.json` |

Se recomienda ubicar todos los servicios en la región Este de EE. UU. (Virginia) para reducir la latencia entre la API y las bases de datos. El proceso completo toma entre 30 y 40 minutos.

> Las contraseñas y cadenas de conexión deben registrarse únicamente en los paneles de cada servicio, nunca en el repositorio.

## 1. PostgreSQL en Neon

1. Crear una cuenta en Neon.
2. Crear un proyecto llamado `nexusmarket` con PostgreSQL 17 en la región AWS US East (N. Virginia).
3. En el panel del proyecto, abrir **Connect**, desactivar **Connection pooling** y copiar la cadena de conexión. Las migraciones de Prisma requieren la conexión directa. La cadena tiene esta forma:

   ```
   postgresql://usuario:clave@ep-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

   Este valor corresponde a la variable `DATABASE_URL`.

## 2. MongoDB en Atlas

1. Crear una cuenta en MongoDB Atlas.
2. Crear un clúster M0 (gratuito) en AWS, región N. Virginia (us-east-1), con el nombre `nexusmarket`.
3. En **Database & Network Access**, crear un usuario de base de datos con contraseña autogenerada y el rol *Read and write to any database*.
4. En la lista de acceso por IP, agregar `0.0.0.0/0` (*Allow access from anywhere*). El plan gratuito de Render no tiene una IP fija; la base sigue protegida por usuario y contraseña.
5. En **Connect → Drivers**, copiar la cadena `mongodb+srv://…`, reemplazar `<db_password>` por la contraseña del usuario y agregar el nombre de la base antes del signo `?`:

   ```
   mongodb+srv://usuario:clave@nexusmarket.xxxxx.mongodb.net/nexusmarket?retryWrites=true&w=majority
   ```

   Este valor corresponde a la variable `MONGO_URL`.

## 3. API en Render

1. Crear una cuenta en Render y autorizar el acceso al repositorio `nexusmarket-backend`.
2. Seleccionar **New → Blueprint** y elegir el repositorio. Render lee `render.yaml` y propone el servicio `nexusmarket-api` en el plan gratuito.
3. Completar las variables solicitadas:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | Cadena de Neon (paso 1) |
   | `MONGO_URL` | Cadena de Atlas (paso 2) |
   | `CORS_ORIGIN` | URL del frontend. Si aún no se conoce, puede usarse `https://nexusmarket.vercel.app` y corregirse en el paso 5. |
   | `ADMIN_EMAIL` | Correo del administrador inicial |
   | `ADMIN_PASSWORD` | Contraseña robusta del administrador (mínimo 8 caracteres) |
   | `ADMIN_DOCUMENT_NUMBER` | Documento del administrador (5 a 20 letras, números o guiones) |

   Render genera `JWT_SECRET` automáticamente. `NODE_ENV`, `NODE_VERSION`, `TRUST_PROXY` y la vigencia del token ya están definidos en el blueprint.
4. Confirmar con **Apply**. El primer despliegue instala dependencias, aplica las migraciones en Neon, compila e inicia el servicio, que crea el administrador al arrancar.
5. Verificar que `https://nexusmarket-api.onrender.com/health` (o la URL asignada por Render) responda `{"status":"ok"}`.

## 4. Frontend en Vercel

1. Crear una cuenta en Vercel e importar el repositorio `nexusmarket-frontend` desde **Add New → Project**. Vercel detecta Vite y aplica la configuración de `vercel.json`.
2. En **Environment Variables**, definir `VITE_API_URL` con la URL de Render, sin barra final (por ejemplo, `https://nexusmarket-api.onrender.com`).
3. Ejecutar **Deploy** y anotar el dominio de producción asignado.

## 5. Conexión entre frontend y API (CORS)

En Render, dentro del servicio `nexusmarket-api`, abrir **Environment** y asignar a `CORS_ORIGIN` el dominio exacto de Vercel, con `https://` y sin barra final. Al guardar, Render vuelve a desplegar el servicio.

Para autorizar varios orígenes, se separan con comas: `https://nexusmarket.vercel.app,http://localhost:5173`.

## 6. Datos de demostración

Desde una copia local de este repositorio, con las dependencias instaladas, ejecutar en PowerShell:

```powershell
$env:SEED_API_URL = "https://nexusmarket-api.onrender.com"
$env:SEED_ADMIN_EMAIL = "<ADMIN_EMAIL configurado en Render>"
$env:SEED_ADMIN_PASSWORD = "<ADMIN_PASSWORD configurado en Render>"
$env:SEED_DEMO_PASSWORD = "<contraseña para los usuarios de demostración>"
npm run seed:demo
```

El script espera a que la API esté disponible y carga los datos a través de ella, de modo que se aplican todas las reglas de negocio. Si los datos de demostración ya existen, no realiza cambios. El contenido detallado se describe en el encabezado de [`scripts/seed-demo.mjs`](./scripts/seed-demo.mjs), y los créditos de las fotos de producto en [`scripts/CREDITOS-IMAGENES.md`](./scripts/CREDITOS-IMAGENES.md).

Usuarios creados (todos con la contraseña definida en `SEED_DEMO_PASSWORD`):

| Rol | Usuarios |
|---|---|
| Compradores | `laura@demo.test`, `carlos@demo.test` |
| Vendedores | `nova@demo.test`, `casaverde@demo.test`, `paginas@demo.test` |
| Vendedor pendiente de habilitación | `pendiente@demo.test` |
| Operador logístico | `logistica@demo.test` |
| Supervisor | `supervisor@demo.test` |

## 7. Recomendaciones para demostraciones

- El plan gratuito de Render suspende la API tras 15 minutos sin actividad, y reactivarla toma cerca de un minuto. Conviene abrir `/health` unos minutos antes de una presentación.
- Un monitor externo (por ejemplo, UptimeRobot) que consulte `/health` cada 10 minutos mantiene la API activa dentro de las 750 horas mensuales del plan.

## Actualizaciones

Cada merge a `main` se publica automáticamente: Render despliega la API y aplica las migraciones nuevas, y Vercel despliega el frontend. Un cambio en las variables de Render provoca un nuevo despliegue; en Vercel es necesario ejecutar **Redeploy**, porque `VITE_API_URL` se fija durante la compilación.

## Solución de problemas

| Síntoma | Causa probable |
|---|---|
| La compilación en Render falla por tipos de Express | Se eliminó `--include=dev` del comando de compilación; con `NODE_ENV=production`, `npm ci` omite TypeScript. |
| `No se pudo conectar a PostgreSQL` | `DATABASE_URL` usa la conexión con *pooling* o le falta `?sslmode=require`. |
| `No se pudo conectar a MongoDB` | Falta `0.0.0.0/0` en la lista de acceso de Atlas, la contraseña contiene caracteres especiales sin codificar o falta `/nexusmarket` en la URL. |
| Error de CORS en el navegador | `CORS_ORIGIN` no coincide exactamente con el dominio de Vercel. |
| Respuesta `429` al iniciar sesión | Se superaron 10 intentos fallidos para la cuenta en 15 minutos (o 100 desde la misma red). El contador se reinicia al cumplirse el plazo o con un nuevo despliegue. |
| El inicio de sesión tarda cerca de un minuto | La API estaba suspendida por inactividad. |
| El frontend intenta conectarse a `localhost:3000` | Falta `VITE_API_URL` en Vercel, o no se ejecutó **Redeploy** después de definirla. |
