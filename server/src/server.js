// becomes only wiring
// Composition root


import "dotenv/config";

import { createApp } from "./app.js";

import ApplicationBootstrap
  from "./bootstrap/ApplicationBootstrap.js";

import databaseClient
  from "./containers/database.container.js";

import {
  apiRouter
} from "./containers/app.container.js";

import {
  requestIdMiddleware,
  requestLoggingMiddleware,
  errorHandler, 
  rateLimitMiddleware
} from "./containers/Infrastructure.container.js";
import { redisClient } from "./containers/redis.container.js";
import { kafkaProducer } from "./containers/kafka.container.js";
import { eventConsumer} from "./containers/messaging.container.js";

const PORT =
  process.env.PORT || 5000;

const app = createApp(
  apiRouter,
  requestIdMiddleware,
  requestLoggingMiddleware,
  rateLimitMiddleware,
  errorHandler
);

const bootstrap =
  new ApplicationBootstrap(
    app,
    databaseClient,
    redisClient,
    kafkaProducer,
    eventConsumer,
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