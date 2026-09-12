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


export default class ApplicationBootstrap {
  constructor(
    app,
    databaseClient,
    redisClient,
    kafkaProducer,
    eventConsumer,
    port,
  ) {
    this.app = app;
    this.databaseClient = databaseClient;
    this.redisClient = redisClient;
    this.kafkaProducer = kafkaProducer;
    this.eventConsumer = eventConsumer;
    this.port = port;
    this.server = null;
  }
  async start() {
    await this.databaseClient.connect();
    try {
      await this.redisClient.connect();
    } catch (error) {
      console.error("Redis connection failed:", error.message);
    }

    await this.kafkaProducer.connect();

    // /health/readiness wirirng
    const healthService = new HealthService(this.databaseClient, this.redisClient, this.kafkaProducer)
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
  }

  async stop() {
    if (this.io) {
      await this.io.close();
    }

    if (this.eventConsumer) {
      await this.eventConsumer.disconnect();
    }

    if (this.kafkaProducer) {
      await this.kafkaProducer.disconnect();
    }

    if (this.redisClient && this.redisClient.isOpen) {
      await this.redisClient.disconnect();
    }
    await this.databaseClient.disconnect();

    if (this.server) {
      this.server.close();
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

// websocket
// SRP
// Lifecycle Management
// Factory Pattern
// Dependency Injection
// Separation of Concerns
// Graceful Shutdown
