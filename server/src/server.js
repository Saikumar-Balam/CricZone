// becomes only wiring
// Composition root


import "dotenv/config";
import {validateEnvironment} from "./config/env.js"

import { createApp } from "./app.js";

import ApplicationBootstrap
  from "./bootstrap/ApplicationBootstrap.js";

import databaseClient
  from "./containers/database.container.js";

import {
  apiRouter
} from "./containers/app.container.js";

import {
  corsMiddleware,
  requestIdMiddleware,
  requestLoggingMiddleware,
  errorHandler, 
  rateLimitMiddleware,
  jsonErrorMiddleware,
  securityHeadersMiddleware
} from "./containers/Infrastructure.container.js";
import { redisClient } from "./containers/redis.container.js";
import { kafkaAdmin, kafkaHealthChecker, kafkaProducer } from "./containers/kafka.container.js";
import { eventConsumer} from "./containers/messaging.container.js";

const {port: PORT} = validateEnvironment()

const app = createApp(
  apiRouter,
  corsMiddleware,
  securityHeadersMiddleware,
  requestIdMiddleware,
  requestLoggingMiddleware,
  rateLimitMiddleware,
  jsonErrorMiddleware,
  errorHandler
);

const bootstrap =
  new ApplicationBootstrap(
    app,
    databaseClient,
    redisClient,
    kafkaProducer,
    eventConsumer,
    kafkaAdmin,
    kafkaHealthChecker,
    PORT
  );

bootstrap.start().catch((error) => {
  console.error(
    "Server startup failed:",
    error.message
  );

  process.exit(1);
});
// Composition Root 