import { logger } from "./logger.container.js";
import RateLimiterMiddleware from "../middleware/RateLimiterMiddleware.js";

import RequestIdMiddleware
  from "../middleware/RequestIdMiddleware.js";

import RequestLoggingMiddleware
  from "../middleware/RequestLoggingMiddleware.js";

import RedisRateLimiter from "../rate-limiting/RedisRateLimiter.js";
import { redisClient } from "./redis.container.js";

import {
  createErrorHandler
} from "../middleware/error.middleware.js";
import InMemoryRateLimiter from "../rate-limiting/InMemoryRateLimiter.js";
import SecurityHeadersMiddleware from "../middleware/SecurityHeadersMiddleware.js";
import CorsMiddleware from "../middleware/CorsMiddleware.js";
import JsonErrorMiddleware from "../middleware/JsonErrorMiddleware.js";



const requestIdMiddleware =
  new RequestIdMiddleware();

const requestLoggingMiddleware =
  new RequestLoggingMiddleware(logger);

const errorHandler =
  createErrorHandler(logger);

const isProduction = process.env.NODE_ENV === "production"

const rateLimiterOptions = {
  limit: 100,
  windowMs: 60 * 1000
}

const rateLimiter = isProduction ? new RedisRateLimiter(redisClient, rateLimiterOptions) : new InMemoryRateLimiter(rateLimiterOptions)


const rateLimitMiddleware = new RateLimiterMiddleware(rateLimiter)
const securityHeadersMiddleware = new SecurityHeadersMiddleware({
  contentSecurityPolicy: true,
  strictTransportSecurity: isProduction ? {
    maxAge: 31536000,
    includeSubDomains: true
  }: false
})
// CORS
const corsEnvironmentVariable = process.env.NODE_ENV === "test" ? process.env.TEST_CORS_ALLOWED_ORIGINS : process.env.CORS_ALLOWED_ORIGINS
const allowedOrigins = (corsEnvironmentVariable || "").split(",").map((origin) => origin.trim()).filter(Boolean)
const corsMiddleware = new CorsMiddleware(allowedOrigins)
const jsonErrorMiddleware = new JsonErrorMiddleware()

export {
  logger,
  requestIdMiddleware,
  requestLoggingMiddleware,
  rateLimiter,
  rateLimitMiddleware,
  securityHeadersMiddleware,
  corsMiddleware,
  jsonErrorMiddleware,
  errorHandler
};

// Dependency Injection — CorsMiddleware receives the resolved origin list.
// Environment Isolation — test CORS configuration is separate from development/production.
// SRP — CorsMiddleware owns CORS behavior.
// Encapsulation — the cors package remains hidden behind our middleware.
// Composition Root — concrete middleware dependencies are assembled in the infrastructure container.
// Least Privilege — only configured origins will be permitted.

// Strategy Pattern — environment selects memory or Redis strategy.
// DIP — RateLimiterMiddleware depends on rate-limiter behavior, not implementation.
// DI — redisClient is injected into RedisRateLimiter.
// LSP — either limiter can replace the other without changing middleware.
// OCP — Redis support was added without modifying the existing middleware.
// SRP — bootstrap owns connections; limiter owns rate-limit calculations.
// Composition Root — concrete strategy selection occurs in the infrastructure container.