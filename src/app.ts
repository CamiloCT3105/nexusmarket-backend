import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { authenticate } from "./middlewares/authenticate";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import buyerRoutes from "./routes/buyerRoutes";
import sellerRoutes from "./routes/sellerRoutes";
import productRoutes from "./routes/productRoutes";
import warehouseRoutes from "./routes/warehouseRoutes";
import inventoryRoutes from "./routes/inventoryRoutes";
import cartRoutes from "./routes/cartRoutes";
import orderRoutes from "./routes/orderRoutes";
import invoiceRoutes from "./routes/invoiceRoutes";
import shipmentRoutes from "./routes/shipmentRoutes";
import returnRoutes from "./routes/returnRoutes";
import refundRoutes from "./routes/refundRoutes";
import reportRoutes from "./routes/reportRoutes";

const app = express();

// Detrás de un proxy (Render), la IP real del cliente llega en X-Forwarded-For. Los límites de
// peticiones dependen de esa IP (ver TRUST_PROXY en .env.example).
app.set("trust proxy", env.trustProxy);

// Encabezados de seguridad HTTP (nosniff, HSTS, sin X-Powered-By, etc.). La API solo responde JSON;
// la política CORP por defecto no afecta a las peticiones CORS del frontend.
app.use(helmet());

// CORS: solo los orígenes configurados (CORS_ORIGIN) pueden llamar a la API desde un navegador.
// La autenticación va en el header Authorization (no en cookies), por eso no se habilitan credenciales.
app.use(
  cors({
    origin: env.corsOrigins,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600, // el navegador recuerda la respuesta del preflight 10 minutos
  })
);

// Las peticiones de la API son pequeñas: un cuerpo mayor se rechaza con 413 antes de procesarlo
app.use(express.json({ limit: "100kb" }));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Rutas públicas: registro y login
app.use("/api/auth", authRoutes);

// A partir de aquí, TODO bajo /api exige token válido (RG-01)
app.use("/api", authenticate);
app.use("/api/reports", reportRoutes);

app.use("/api/users", userRoutes);
app.use("/api/buyers", buyerRoutes);
app.use("/api/sellers", sellerRoutes);
app.use("/api/products", productRoutes);
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/carts", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/shipments", shipmentRoutes);
app.use("/api/returns", returnRoutes);
app.use("/api/refunds", refundRoutes);

// Siempre al final: rutas inexistentes y manejo central de errores
app.use(notFoundHandler);
app.use(errorHandler);

export default app;