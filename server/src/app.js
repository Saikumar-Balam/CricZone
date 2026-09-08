// app.js — factory pattern + pure DI

import express from "express";
import cors from "cors";

export const createApp = (
  apiRouter,
  requestIdMiddleware,
  requestLoggingMiddleware,
  rateLimitMiddleware,
  errorHandler,
) => {
  const app = express();

  // Global middleware
  app.use(cors());

  app.use(requestIdMiddleware.handle);

  app.use(requestLoggingMiddleware.handle);
  app.use(rateLimitMiddleware.handle);

  app.use(express.json());

  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "OK",
      service: "CricZone API",
    });
  });

  // API routes
  app.use("/api/v1", apiRouter);

  // Must remain last
  app.use(errorHandler);

  return app;
};
