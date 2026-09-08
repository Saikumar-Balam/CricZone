import { logger } from "./logger.container.js";
import RateLimiterMiddleware from "../middleware/RateLimiterMiddleware.js";

import RequestIdMiddleware
  from "../middleware/RequestIdMiddleware.js";

import RequestLoggingMiddleware
  from "../middleware/RequestLoggingMiddleware.js";

import {
  createErrorHandler
} from "../middleware/error.middleware.js";
import InMemoryRateLimiter from "../rate-limiting/InMemoryRateLimiter.js";



const requestIdMiddleware =
  new RequestIdMiddleware();

const requestLoggingMiddleware =
  new RequestLoggingMiddleware(logger);

const errorHandler =
  createErrorHandler(logger);

const rateLimiter = new InMemoryRateLimiter({
  limit: 100,
  windowMs: 60 * 1000
})

const rateLimitMiddleware = new RateLimiterMiddleware(rateLimiter)

export {
  logger,
  requestIdMiddleware,
  requestLoggingMiddleware,
  rateLimiter,
  rateLimitMiddleware,
  errorHandler
};