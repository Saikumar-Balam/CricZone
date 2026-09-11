import RedisLiveCache from "../cache/redis/RedisLiveCache.js";
import PostgresScorecardRepository from "../repositories/postgres/postgresScorecardRepository.js";
import LiveUpdateService from "../services/LiveUpdateService.js";
import databaseClient from "./database.container.js";
import { logger } from "./logger.container.js"
import WebSocketGateway from "../websocket/contracts/WebSocketGateway.js";
import {redisClient} from "./redis.container.js"
import LiveBallEventHandler from "../messaging/handlers/LiveBallEventHandler.js"
import { metrics } from "./metrics.container.js";

const scorecardRepository = new PostgresScorecardRepository(databaseClient)

const liveCache = new RedisLiveCache(redisClient)

const liveUpdateService = new LiveUpdateService(scorecardRepository, liveCache, WebSocketGateway, logger, metrics)

const liveBallEventHandler = new LiveBallEventHandler(liveUpdateService, logger)

export {
    scorecardRepository,
    liveCache,
    liveUpdateService,    
    liveBallEventHandler
}   

// lld 
// Dependency Injection (DI): databaseClient, redisClient, webSocketGateway, and logger are created outside the business classes and passed into them.
// Dependency Inversion Principle (DIP): LiveUpdateService depends on abstractions/roles like repository, cache, and gateway rather than creating PostgreSQL/Redis/Socket.IO objects itself.
// Single Responsibility Principle (SRP): each class has one focused job:
// PostgresScorecardRepository → PostgreSQL persistence
// RedisLiveCache → Redis cache operations
// LiveUpdateService → orchestration
// LiveBallEventHandler → event handling/routing
// container → object creation/wiring
// Composition Root / Dependency Container pattern: this file is effectively the place where concrete implementations are assembled.
// Open/Closed Principle (OCP): you can replace RedisLiveCache or PostgresScorecardRepository with another implementation without rewriting LiveUpdateService, assuming the same contract is followed.
// Liskov Substitution Principle (LSP): any valid implementation of ScorecardRepository or LiveCache can substitute the current concrete class.
// Constructor Injection: dependencies are supplied through constructors instead of imported/created internally.
// Separation of Concerns: database, cache, messaging, WebSocket delivery, and orchestration are separate.
