import {createClient} from "redis"
import RedisCache from "../cache/RedisCache.js"
import { logger } from "./logger.container.js"

const redisClient = createClient({
    url: process.env.REDIS_URL 
})

redisClient.on("error", (error) => {
    logger.error("Redis client error",{
        errorMessage:error.message})
})

const redisCache = new RedisCache(redisClient, logger)

export{
    redisClient,
    redisCache
}

// Composition Root       
// Dependency Injection   
// SRP                    
// DIP                    
// Centralized wiring     
// Loose coupling         