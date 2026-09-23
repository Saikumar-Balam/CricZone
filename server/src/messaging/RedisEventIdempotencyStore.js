import EventIdempotencyStore from "./contracts/EventIdempotencyStore.js";

export default class RedisEventIdempotencyStore extends EventIdempotencyStore{
    constructor(redisClient, {
        keyPrefix = "criczone:kafka:processed:",
        ttlSeconds = 86400
    } = {})
    {
        super()
        this.redisClient = redisClient
        this.keyPrefix = keyPrefix
        this.ttlSeconds = ttlSeconds
    }

    buildKey(eventId)
    {
        return `${this.keyPrefix}${eventId}`
    }

    async claim(eventId)
    {
        const key =  this.buildKey(eventId)
        const result = await this.redisClient.set(key, "processing", {
            NX: true,
            EX: this.ttlSeconds
        })
        return result === "OK"
    }

    async release(eventId)
    {
        const key = this.buildKey(eventId)
        await this.redisClient.del(key)
    }
}

// DIP — consumer will depend on the idempotency-store abstraction.
// DI — Redis/Valkey client is injected.
// SRP — atomic deduplication is owned by the idempotency store.
// Adapter Pattern — Redis commands stay behind a domain-facing interface.
// Open/Closed Principle — another idempotency backend can implement the same contract.
// Fail-Safe Processing — failed processing releases the claim so the event can be retried.