import express from "express";
import { authenticate } from "./middlewares/authenticate";
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

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Rutas públicas: registro y login
app.use("/api/auth", authRoutes);

// A partir de aquí, TODO bajo /api exige token válido (RG-01)
app.use("/api", authenticate);

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

export default app;