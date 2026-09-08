import Cache from "./contracts/cache.js";
export default class RedisCache extends Cache
{
    constructor(redisClient, logger)
    {
        super()
        this.redisClient = redisClient
        this.logger = logger
    }

    async get(key)
    {
        try{
        const value = await this.redisClient.get(key)
        if(value === null)
        {
            return null
        }
        return JSON.parse(value)
    }
    catch(error)
    {
        this.logger.warn("Redis cache GET failed",{
            cacheKey: key,
            errorMessage: error.message
        })
        return null
    }
    }

    async set(key, value, ttlSeconds)
    {
        try{
        const serializedValue = JSON.stringify(value)
        if(ttlSeconds)
        {
            await this.redisClient.set(key,serializedValue,{
                EX: ttlSeconds
            })
            return;
        }
        await this.redisClient.set(
            key, 
            serializedValue
        )
    }
    catch(error)
    {
        this.logger.warn("Redis cache SET failed",{
            cacheKey: key,
            errorMessage: error.message
        })
    }
    }

    async delete(key)
    {
        try{
        await this.redisClient.del(key)
    }
    catch(error)
    {
        this.logger.warn("Redis cache DELETE failed",{
            cacheKey: key,
            errorMessage: error.message
        })
    }
}
}
// SRP 
// RedisCache only translates Cache operations into Redis operations.

// Inheritance / abstraction 
// RedisCache extends Cache.

// DI 
// redisClient is injected through constructor.

// DIP 
// higher application layers can depend on Cache abstraction.

// LSP 
// RedisCache can substitute any valid Cache implementation.

// OCP 
// Later we could add:
// MemoryCache
// RedisCache
// MockCache
// without changing consumers.

// Encapsulation 
// Redis-specific JSON serialization and commands stay inside RedisCache.