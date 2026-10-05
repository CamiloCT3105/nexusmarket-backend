import express from "express";
import userRoutes from "./routes/userRoutes";
import buyerRoutes from "./routes/buyerRoutes";
import sellerRoutes from "./routes/sellerRoutes";
import productRoutes from "./routes/productRoutes";

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/users", userRoutes);
app.use("/api/buyers", buyerRoutes);
app.use("/api/sellers", sellerRoutes);
app.use("/api/products", productRoutes);

export default app;