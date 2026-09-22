import express from "express";
import userRoutes from "./routes/userRoutes";
import buyerRoutes from "./routes/buyerRoutes";

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/users", userRoutes);
app.use("/api/buyers", buyerRoutes);

export default app;