import express from "express";
import userRoutes from "./routes/userRoutes";

const app = express();

// Middleware para parsear JSON en el body de las peticiones
app.use(express.json());

// Ruta de prueba (health check)
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Montamos las rutas de usuario bajo el prefijo /api/users
app.use("/api/users", userRoutes);

export default app;