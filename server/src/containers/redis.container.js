import { createClient } from "redis";
import RedisCache from "../cache/RedisCache.js";
import { logger } from "./logger.container.js";

const nodeEnv = process.env.NODE_ENV || "development";

const redisUrl =
  nodeEnv === "test"
    ? process.env.TEST_REDIS_URL
    : process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error(
    `Redis URL is not configured for environment: ${nodeEnv}`
  );
}

const redisClient = createClient({
  url: redisUrl,

  // Keep an Aiven Valkey connection active below its 300-second idle timeout.
  pingInterval: 60_000,

  // Reject commands when Redis is disconnected.
  disableOfflineQueue: true,

  socket: {
    // Limit the initial connection attempt.
    connectTimeout: 3000,

    // Keep attempting reconnection with bounded delays.
    reconnectStrategy: (retries) =>
      Math.min(200 * 2 ** Math.min(retries, 4), 3000)
  }
});

redisClient.on("error", (error) => {
  logger.error("Redis client error", {
    errorMessage: error.message
  });
});

const redisCache = new RedisCache(redisClient, logger);

export {
  redisClient,
  redisCache
};

// Composition Root       
// Dependency Injection   
// SRP                    
// DIP                    
// Centralized wiring     
// Loose coupling         