import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from "vitest"

import RedisCache
    from "../../src/cache/RedisCache.js"

import RedisLiveCache
    from "../../src/cache/redis/RedisLiveCache.js"


describe("Redis Unavailable", () => {

    describe("RedisCache failure behavior", () => {

        let redisClient
        let logger
        let cache

        beforeEach(() => {

            redisClient = {
                get: vi.fn(),
                set: vi.fn(),
                del: vi.fn()
            }

            logger = {
                warn: vi.fn()
            }

            cache = new RedisCache(
                redisClient,
                logger
            )
        })


        it("should return null when Redis GET fails", async () => {

            redisClient.get.mockRejectedValue(
                new Error("Redis unavailable")
            )

            const result =
                await cache.get("match:1")

            expect(result).toBeNull()
        })


        it("should log warning when Redis GET fails", async () => {

            redisClient.get.mockRejectedValue(
                new Error("Redis unavailable")
            )

            await cache.get("match:1")

            expect(logger.warn)
                .toHaveBeenCalledWith(
                    "Redis cache GET failed",
                    {
                        cacheKey: "match:1",
                        errorMessage:
                            "Redis unavailable"
                    }
                )
        })


        it("should not throw when Redis SET fails", async () => {

            redisClient.set.mockRejectedValue(
                new Error("Redis unavailable")
            )

            await expect(
                cache.set(
                    "match:1",
                    { runs: 100 },
                    60
                )
            ).resolves.toBeUndefined()
        })


        it("should log warning when Redis SET fails", async () => {

            redisClient.set.mockRejectedValue(
                new Error("Redis unavailable")
            )

            await cache.set(
                "match:1",
                { runs: 100 },
                60
            )

            expect(logger.warn)
                .toHaveBeenCalledWith(
                    "Redis cache SET failed",
                    {
                        cacheKey: "match:1",
                        errorMessage:
                            "Redis unavailable"
                    }
                )
        })


        it("should not throw when Redis DELETE fails", async () => {

            redisClient.del.mockRejectedValue(
                new Error("Redis unavailable")
            )

            await expect(
                cache.delete("match:1")
            ).resolves.toBeUndefined()
        })


        it("should log warning when Redis DELETE fails", async () => {

            redisClient.del.mockRejectedValue(
                new Error("Redis unavailable")
            )

            await cache.delete("match:1")

            expect(logger.warn)
                .toHaveBeenCalledWith(
                    "Redis cache DELETE failed",
                    {
                        cacheKey: "match:1",
                        errorMessage:
                            "Redis unavailable"
                    }
                )
        })

    })


    describe("RedisLiveCache failure behavior", () => {

        let redisClient
        let liveCache

        beforeEach(() => {

            redisClient = {
                get: vi.fn(),
                set: vi.fn(),
                del: vi.fn(),
                lPush: vi.fn(),
                lTrim: vi.fn(),
                expire: vi.fn(),
                lRange: vi.fn()
            }

            liveCache =
                new RedisLiveCache(redisClient)
        })


        it("should propagate Redis GET failure", async () => {

            redisClient.get.mockRejectedValue(
                new Error("Redis unavailable")
            )

            await expect(
                liveCache.getLiveState(1)
            ).rejects.toThrow(
                "Redis unavailable"
            )
        })


        it("should propagate Redis SET failure", async () => {

            redisClient.set.mockRejectedValue(
                new Error("Redis unavailable")
            )

            await expect(
                liveCache.setLiveState(
                    1,
                    {
                        runs: 100,
                        wickets: 2
                    }
                )
            ).rejects.toThrow(
                "Redis unavailable"
            )
        })


        it("should propagate commentary Redis failure", async () => {

            redisClient.lPush.mockRejectedValue(
                new Error("Redis unavailable")
            )

            await expect(
                liveCache.appendCommentary(
                    1,
                    {
                        eventId: "event-001",
                        text: "FOUR"
                    }
                )
            ).rejects.toThrow(
                "Redis unavailable"
            )

            expect(redisClient.lTrim)
                .not.toHaveBeenCalled()

            expect(redisClient.expire)
                .not.toHaveBeenCalled()
        })


        it("should propagate cache invalidation failure", async () => {

            redisClient.del.mockRejectedValue(
                new Error("Redis unavailable")
            )

            await expect(
                liveCache.invalidateScorecard(1)
            ).rejects.toThrow(
                "Redis unavailable"
            )
        })

    })

})

// SRP — Redis adapters own Redis-specific behavior.
// DI — Redis client and logger are injected.
// DIP — consumers can depend on cache abstractions.
// LSP — Redis implementation remains replaceable.
// Encapsulation — Redis commands stay inside cache implementations.
// Graceful Degradation — ordinary cache failures don't break requests.
// Failure Propagation — live-cache failures remain visible to the orchestration layer.