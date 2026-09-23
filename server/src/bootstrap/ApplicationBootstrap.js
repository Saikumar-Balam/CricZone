// Application lifecycle

import { createWebSocketInfrastructure } from "../containers/websocket.container.js";
import { KafkaTopics } from "../messaging/KafkaTopics.js";
import http from "node:http";
import PostgresScorecardRepository from "../repositories/postgres/postgresScorecardRepository.js";
import RedisLiveCache from "../cache/redis/RedisLiveCache.js";
import LiveUpdateService from "../services/LiveUpdateService.js";
import { logger } from "../containers/logger.container.js";
import LiveBallEventHandler from "../messaging/handlers/LiveBallEventHandler.js"
import HealthService from "../health/HealthService.js";
import HealthController from "../controllers/HealthController.js";
import createHealthRouter from "../routes/health.route.js";
import { metrics } from "../containers/metrics.container.js";
import withTimeout from "../utils/withTimeout.js";


export default class ApplicationBootstrap {
  constructor(
    app,
    databaseClient,
    redisClient,
    kafkaProducer,
    eventConsumer,
    kafkaAdmin,
    kafkaHealthChecker,
    port,
  ) {
    this.app = app;
    this.databaseClient = databaseClient;
    this.redisClient = redisClient;
    this.kafkaProducer = kafkaProducer;
    this.eventConsumer = eventConsumer;
    this.kafkaAdmin = kafkaAdmin
    this.kafkaHealthChecker = kafkaHealthChecker
    this.port = port;
    this.server = null;
  }
  registerShutdownHandlers()
  {
    let isShuttingDown = false
    const shutdown = async(signal) => {
      if(isShuttingDown)
      {
        return 
      }
      isShuttingDown = true 
      console.log(`${signal} received. Shutting down gracefully...`)
      try {
        await this.stop()
        console.log("CricZone shutdown completed")
        process.exit(0)
      }
      catch(error)
      {
        console.error("Graceful shutdown failed:", error.message)
        process.exit(1)
      }
    }
    process.on("SIGTERM", () => shutdown("SIGTERM"))
    process.on("SIGINT", () => shutdown("SIGINT"))
  }
  async start() {
    await this.databaseClient.connect();
    try {
      await this.redisClient.connect();
    } catch (error) {
      console.error("Redis connection failed:", error.message);
    }

    await this.kafkaProducer.connect();
    await this.kafkaAdmin.connect()

    // /health/readiness wirirng
    const healthService = new HealthService(this.databaseClient, this.redisClient, this.kafkaHealthChecker)
    const healthController = new HealthController(healthService)
    const healthRouter = createHealthRouter(healthController)

    this.app.use("/", healthRouter)

    // http server creation
    this.server = http.createServer(this.app);

    // create websocket infrastructure
    const { io, webSocketGateway } = createWebSocketInfrastructure(this.server);
    this.io = io;
    this.webSocketGateway = webSocketGateway;

    const scorecardRepository = new PostgresScorecardRepository(this.databaseClient)
    const liveCache = new  RedisLiveCache(this.redisClient)
    const liveUpdateService = new LiveUpdateService(scorecardRepository, liveCache, webSocketGateway, logger, metrics)

    const liveBallEventHandler = new LiveBallEventHandler(liveUpdateService, logger)

    await this.eventConsumer.connect();

    await this.eventConsumer.subscribe(
      KafkaTopics.LIVE_BALL_EVENTS,
      liveBallEventHandler.handle,
    );

    this.server.listen(this.port, () => {
      console.log(`CricZone API Running on ${this.port}`);
    });
    this.registerShutdownHandlers()
  }

  async stop() {
    const errors = []
    if (this.io) {
      console.log("1. Closing WebSocket and http server...")
      try {
      await this.io.close();
      console.log("1. websocket connection and http server are closed")
      }
      catch(error)
      {
        console.log("1. websocket/HTTP connection closed failed")
        errors.push({resource: "WebSocket", error})
      }
    }
    // stop accepting http traffic
    else if(this.server)
      {
      console.log("1. Closing HTTP server...")
      try {
      await new Promise((resolve, reject) => {
        this.server.close((error) =>{
          if(error)
          {
            reject(error)
            return
          }
          resolve()
        })
      })
       console.log("1. HTTP server closed")
    }
    catch(error)
    {
      errors.push({resource: "HTTP Server", error})
      console.log("1. HTTP server close FAILED")
    }
    }

    // close Kafka consumer connection
    console.log("2. Disconnecting Event Consumer...")
    if(this.eventConsumer)
    {
      try {
        await withTimeout(this.eventConsumer.disconnect(), 10000, "Kafka consumer disconnect")
        console.log("2. event consumer connection closed")
      }
      catch(error)
      {
        errors.push({resource: "Kafka Consumer Disconnect", error})
        console.error("2. event consumer connection closed fail", error.message)
      }
    }
    console.log("3. Kafka Producer closing...")
    if (this.kafkaProducer) {
      try {
      await this.kafkaProducer.disconnect();
      console.log("3. Kafka Producer connection closed")
      }
      catch(error)
      {
        errors.push({resource: "Kafka Producer", error})
        console.log("3. Kafka Producer connection closed failed")
      }
    }

    console.log("4. Kafka Admin closing...")
    if(this.kafkaAdmin)
    {
      try {
        await this.kafkaAdmin.disconnect()
        console.log("4. Kafka Admin connection closed")
      }
      catch(error)
      {
        errors.push({resource: "Kafka Admin", error})
        console.log("4. Kafka Admin connection closed failed")
      }
    }

    console.log("5. redisClient closing...")
    if (this.redisClient && this.redisClient.isOpen) {
      try {
      await this.redisClient.disconnect();
      console.log("5.redisClient connection closed")
      }
      catch(error)
      {
        errors.push({resource: "Redis", error})
        console.log("5. redisClient connection closed failed")
      }
    }

    console.log("6. PostgreSQL closing...")
    if(this.databaseClient)
    {
      try {
    await this.databaseClient.disconnect();
    console.log("6. PostgreSQL connection closed")
      }
      catch(error)
      {
        errors.push({resource: "PotsgreSQL", error})
        console.log("6. PostgreSQL connection closed failed")
      }
    }
    // Report cleanup failures only after every resource received a shutdown attempt
    if(errors.length>0)
    {
      for(const failure of errors)
      {
        console.error(`${failure.resource} shutdown failed:`, failure.error.message)
      }
      throw new AggregateError(errors.map(failure => failure.error), "One or more resources failed to shutdown")
    }

  }
}

// redis wiring lld principles

// Dependency Injection
// DIP
// SRP
// Shared infrastructure
// Graceful degradation
// Kafka is more correctness-sensitive than Redis, so for now I would let startup fail if the Kafka producer cannot connect, rather than silently pretending live-event infrastructure exists.

// Dependency Injection  — Kafka producer and logger are constructor-injected.

// DIP  — future publishing logic depends on EventProducer, not KafkaJS.

// SRP  — Kafka configuration, messaging abstraction, startup, and business logic remain separate.

// Composition Root  — containers and server.js assemble dependencies.

// Singleton-like shared infrastructure  — one Kafka producer connection is reused rather than creating a producer for every request.

// OCP/LSP  — KafkaEventProducer can later be replaced by another valid EventProducer.

// Lifecycle Management — startup and shutdown remain centralized.
// SRP — ApplicationBootstrap owns application lifecycle.
// DI — bootstrap shuts down injected infrastructure dependencies.
// Composition Root — server.js remains wiring-only.
// Resource Safety — HTTP, WebSocket, Kafka, Redis, and PostgreSQL are explicitly closed.
// Idempotency — duplicate shutdown signals don't run cleanup twice.

// Graceful Shutdown — existing traffic is allowed to finish before infrastructure disappears.

// Resource Safety — every resource gets a cleanup attempt.
// Failure Isolation — one disconnect failure doesn't block unrelated cleanup.
// Lifecycle Management — ApplicationBootstrap centrally controls shutdown.
// SRP — bootstrap remains responsible for application lifecycle.
// Error Aggregation — cleanup errors are collected and reported after cleanup attempts.
// Dependency Ordering — Kafka processing infrastructure is stopped before Redis/PostgreSQL.
