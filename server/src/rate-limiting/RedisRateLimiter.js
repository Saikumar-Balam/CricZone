import RateLimiter from "./contracts/RateLimiter.js";

export default class RedisRateLimiter extends RateLimiter {
    constructor(redisClient, {
        limit = 100, 
        windowMs = 60 * 1000,
        keyPrefix = "rate-limit:"
    } = {})
    {
        super()
        this.redisClient = redisClient,
        this.limit = limit
        this.windowMs = windowMs,
        this.keyPrefix = keyPrefix
    }

    async consume(key)
    {
        const redisKey = `${this.keyPrefix}${key}`
        const count = await this.redisClient.incr(redisKey)

        // 1st request starts from the rate-limit window
        if(count == 1)
        {
            await this.redisClient.pExpire(redisKey, this.windowMs)
        }
        let ttl = await this.redisClient.pTTL(redisKey)
        // Defensive recovery in case the key has no expiry
        if(ttl < 0)
        {
            await this.redisClient.pExpire(redisKey, this.windowMs)
            ttl = this.windowMs
        }
        const resetAt = Date.now() + ttl
        const remaining = Math.max(this.limit - count, 0)
        return {
            allowed: count <= this.limit,
            remaining,
            resetAt
        }
    }
}

// Strategy Pattern — InMemoryRateLimiter and RedisRateLimiter implement the same behavior.
// DIP — HTTP middleware depends on RateLimiter, not Redis.
// DI — existing redisClient is injected through the constructor.
// LSP — Redis returns the same allowed, remaining, resetAt contract.
// OCP — distributed rate limiting is added without changing RateLimiterMiddleware.
// SRP — RedisRateLimiter only manages distributed rate-limit state.
// Encapsulation — Redis key/TTL mechanics stay inside the Redis strategy.
// Connection Reuse — CricZone's existing Redis client is reused rather than creating another connection.