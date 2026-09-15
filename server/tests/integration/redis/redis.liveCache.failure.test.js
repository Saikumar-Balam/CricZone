import { describe, it, vi, expect } from "vitest";
import RedisLiveCache from "../../../src/cache/redis/RedisLiveCache.js";

describe("RedisLiveCache Failure Behavior", () => {
    it("should propagate Redis failure from setLiveState", async () => {
        const redisClient = {
            set: vi.fn().mockRejectedValue(new Error("Redis SET failed"))
        }

        const liveCache = new RedisLiveCache(redisClient)
        await expect(liveCache.setLiveState(999001,{
            matchId: 999001,
            totalRuns: 150
        })).rejects.toThrow("Redis SET failed")
    })

    it("should propagate Redis failure from getLiveState", async () => {
        const redisClient = {
            get: vi.fn().mockRejectedValue(new Error("Redis GET failed"))
        }
        const liveCache = new RedisLiveCache(redisClient)
        await expect(liveCache.getLiveState(999001)).rejects.toThrow("Redis GET failed")
    })

    it("should propagate Redis failure from invalidateScorecard", async () => {
        const redisClient = {
            del: vi.fn().mockRejectedValue(new Error("Redis DEL failed"))
        }
        const liveCache = new RedisLiveCache(redisClient)
        await expect(liveCache.invalidateScorecard(999001)).rejects.toThrow("Redis DEL failed")
    })

    it("should propagate Redis failure from appendCommentary", async () => {
        const redisClient = {
            lPush: vi.fn().mockRejectedValue(new Error("Redis LPUSH failed"))
        }

        const liveCache = new RedisLiveCache(redisClient)
        await expect(liveCache.appendCommentary(999001,{
            text: "FOUR through covers"
        })).rejects.toThrow("Redis LPUSH failed")
    })

    it("should propagate Redis failure from completed match promotion", async () => {
        const redisClient = {
            expire: vi.fn().mockRejectedValue(new Error("Redis EXPIRE failed"))
        }

        const liveCache = new RedisLiveCache(redisClient)
        await expect(liveCache.promoteCompletedMatch(999001)).rejects.toThrow("Redis EXPIRE failed")
    })
})

// LLD principles used

// Dependency Injection: RedisLiveCache accepts the Redis client externally, so we can inject a failing implementation.

// DIP: the class works against the behavior of the dependency, not against a hardcoded client it constructs internally.

// SRP: RedisLiveCache performs cache operations; it does not decide how Redis connections are created or recovered.

// Testability through abstraction: because infrastructure is injected, failure scenarios are easy to simulate.