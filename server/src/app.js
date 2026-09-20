// app.js — factory pattern + pure DI

import express from "express";

import { httpMetricsMiddleware } from "./containers/metrics.container.js";
import router from "./routes/metrics.route.js";


export const createApp = (
  apiRouter,
  corsMiddleware,
  securityHeadersMiddleware,
  requestIdMiddleware,
  requestLoggingMiddleware,
  rateLimitMiddleware,
  jsonErrorMiddleware,
  errorHandler,
) => {
  const app = express();
  // ensure express itself runs in production environment
  app.set("env", process.env.NODE_ENV || "development") 
  // hides the framework used from the clients
  app.disable("x-powered-by")
  // Trust proxy configuarion
  if(process.env.NODE_ENV === "production")
  {
    app.set("trust proxy", 1)
  }

  // Global middleware
  app.use(corsMiddleware.handle);
  app.use(securityHeadersMiddleware.handle)
  app.use(requestIdMiddleware.handle);

  app.use(requestLoggingMiddleware.handle);
  app.use(httpMetricsMiddleware.handle)

  app.use(express.json({
    limit: "10kb"
  }));

  // Prometheus endpoint
  app.use("/metrics", router)
  // API routes
  // public api routes 
  app.use("/api/v1", rateLimitMiddleware.handle, 
    apiRouter);

// Convert JSON parser errors into application errors
  app.use(jsonErrorMiddleware.handle)
  // Must remain last
  app.use(errorHandler);

  return app;
};

// SRP — rate-limit middleware handles API request throttling.
// Middleware Composition — rate limiting is attached at the /api/v1 boundary.
// Least Privilege — only the traffic requiring this policy receives it.
// YAGNI — no arbitrary per-resource limits without evidence.
// OCP — additional policies can later be attached without changing the limiter implementation.
// Separation of Concerns — monitoring endpoints and public API traffic have independent concerns.
// Configuration over duplication — one policy covers equivalent public REST resources.
