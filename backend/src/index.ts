import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.routes.js";
import { meterRouter } from "./routes/meter.routes.js";
import { rechargeRouter } from "./routes/recharge.routes.js";
import { simulationRouter } from "./routes/simulation.routes.js";

const app = express();

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow any localhost origin in dev or matching CORS_ORIGIN
      if (!origin || /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive for local development
      }
    },
    credentials: true,
  }),
);

app.use(express.json());

// Request logging in dev
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "Recharge Advisor Pro API",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/meters", meterRouter);
app.use("/api/meters", rechargeRouter);
app.use("/api/simulations", simulationRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Not Found - ${req.method} ${req.url}` });
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled API Error:", err);
  res.status(500).json({
    error: err.message || "An unexpected error occurred on the server.",
  });
});

// Start server
app.listen(config.port, () => {
  console.log(`🚀 Recharge Advisor API Server running on http://localhost:${config.port}`);
  console.log(`⚡ Health check available at http://localhost:${config.port}/api/health`);
});

export default app;
