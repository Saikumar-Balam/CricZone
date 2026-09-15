import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest";
import { createTestRedis } from "../../helpers/testRedis.js";
import RedisLiveCache from "../../../src/cache/redis/RedisLiveCache.js"
import { CacheKeys } from "../../../src/cache/CacheKeys.js";
import { CacheTTL } from "../../../src/cache/CacheTTL.js";

describe("Redis Live Cache Integration", () => {
    let redisClient
    let liveCache 
    const matchId = 999001

    beforeAll( async () => {
        redisClient = createTestRedis()
        await redisClient.connect()
        liveCache = new RedisLiveCache(redisClient)
    })

    beforeEach(async () => {
    await redisClient.del(
        CacheKeys.matchLive(matchId)
    )

    await redisClient.del(
        CacheKeys.scorecardByMatchId(matchId)
    )

    await redisClient.del(
        CacheKeys.matchSummary(matchId)
    )

    await redisClient.del(
        CacheKeys.matchCommentary(matchId)
    )
})

afterEach(async () => {
    await redisClient.del(
        CacheKeys.matchLive(matchId)
    )

    await redisClient.del(
        CacheKeys.scorecardByMatchId(matchId)
    )

    await redisClient.del(
        CacheKeys.matchSummary(matchId)
    )

    await redisClient.del(
        CacheKeys.matchCommentary(matchId)
    )
})

    afterAll(async () => {
        if(redisClient?.isReady)
        {
            await redisClient.quit()
        }
    })

    it("should store live match state in Redis", async () => {
        const liveState = {
            matchId,
            totalRuns: 125,
            wickets: 3,
            overs: "15.2"
        }
        await liveCache.setLiveState(matchId, liveState)
        const key = CacheKeys.matchLive(matchId)
        const storedValue = await redisClient.get(key)
        expect(storedValue).not.toBeNull()
        expect(JSON.parse(storedValue)).toEqual(liveState)

        const ttl = await redisClient.ttl(key)
        expect(ttl).toBeGreaterThan(0)
        expect(ttl).toBeLessThanOrEqual(CacheTTL.LIVE_MATCH)
    })

    it("should return live match state from Redis", async () => {
        const liveState = {
            matchId,
            totalRuns: 145,
            wickets: 4,
            overs: "17.3"
        }
        const key = CacheKeys.matchLive(matchId)
        await redisClient.set(key, JSON.stringify(liveState))
        const result = await liveCache.getLiveState(matchId)
        expect(result).toEqual(liveState)
    })

    it("should return null when live state does not exist", async () => {
        const result = await liveCache.getLiveState(matchId)
        expect(result).toBeNull()
    })

    it("should invalidate cached scorecard", async () => {
        const key = CacheKeys.scorecardByMatchId(matchId)
        const scorecard = {
            matchId,
            innings: 2,
            totalRuns: 278
        }
        await redisClient.set(key, JSON.stringify(scorecard))

        const beforeDelete = await redisClient.get(key)
        expect(beforeDelete).not.toBeNull()
        await liveCache.invalidateScorecard(matchId)
        const afterDelete = await redisClient.get(key)
        expect(afterDelete).toBeNull()
    })

    it("should invalidate cached match summary", async () => {
        const key = CacheKeys.matchSummary(matchId)
        const matchSummary = {
            matchId,
            status: "LIVE",
            score: "178/4"
        }
        await redisClient.set(key, JSON.stringify(matchSummary))
        const beforeDeleted = await redisClient.get(key)
        expect(beforeDeleted).not.toBeNull()
        await liveCache.invalidateSummary(matchId)
        const afterDeleted = await redisClient.get(key)
        expect(afterDeleted).toBeNull()
    })

    it("should append commentary event to Redis", async () => {
        const commentaryEvent = {
            matchId,
            over: 15,
            ball:3,
            text: "FOUR! Driven through covers"
        }
        await liveCache.appendCommentary(matchId, commentaryEvent)
        const key = CacheKeys.matchCommentary(matchId)
        const events = await redisClient.lRange(key, 0, -1)
        expect(events).toHaveLength(1)
        expect(JSON.parse(events[0])).toEqual(commentaryEvent)
        
        const ttl = await redisClient.ttl(key)
        expect(ttl).toBeGreaterThan(0)
        expect(ttl).toBeLessThanOrEqual(CacheTTL.COMMENTARY)
    })

    it("should not create commentary cache when event is missing", async () => {
        await liveCache.appendCommentary(matchId, null)
        const key = CacheKeys.matchCommentary(matchId)
        const exists = await redisClient.exists(key)
        expect(exists).toBe(0)
    })

    it("should return recent commentaries from Redis", async () => {
        const firstEvent = {
            matchId,
            over: 15,
            ball: 1,
            text: "Single taken"
        }

        const secondEvent = {
            matchId,
            over: 15,
            ball: 2,
            text: "FOUR through covers"
        }

        const key = CacheKeys.matchCommentary(matchId)
        await redisClient.lPush(key, JSON.stringify(firstEvent))
        await redisClient.lPush(key, JSON.stringify(secondEvent))

        const result = await liveCache.getRecentCommentary(matchId)
        expect(result).toHaveLength(2)
        expect(result[0]).toEqual(secondEvent)
        expect(result[1]).toEqual(firstEvent)
    })

    it("should return empty array when commenatry deos not exist", async () => {
        const result = await liveCache.getRecentCommentary(matchId)
        expect(result).toEqual([])
    })

    it("should expire live state after TTL", async () => {
        const key = CacheKeys.matchLive(matchId)
        const liveState = {
            matchId,
            totalRuns: 210,
            wickets: 5,
            overs: "18.4"
        }

        await redisClient.set(key, JSON.stringify(liveState), {
            EX: 1
        })
        const beforeExpiry = await redisClient.get(key)
        expect(beforeExpiry).not.toBeNull()
        await new Promise(resolve => 
            setTimeout(resolve, 1200)
        )

        const afterExpiry = await redisClient.get(key)
        expect(afterExpiry).toBeNull()
    })

    it("should apply commentary TTL", async () => {
        const commentaryEvent = {
            matchId,
            over: 18,
            ball: 5,
            text: "SIX over long-on"
        }

        await liveCache.appendCommentary(matchId, commentaryEvent)
        const key = CacheKeys.matchCommentary(matchId)
        const ttl = await redisClient.ttl(key)
        expect(ttl).toBeGreaterThan(0)
        expect(ttl).toBeLessThanOrEqual(CacheTTL.COMMENTARY)
    })

    it("should promote completed match caches with completed-match TTLs", async () => {
        const summaryKey = CacheKeys.matchSummary(matchId)
        const scorecardKey = CacheKeys.scorecardByMatchId(matchId)
        const commentaryKey = CacheKeys.matchCommentary(matchId)
        const liveKey = CacheKeys.matchLive(matchId)
        await redisClient.set(summaryKey, JSON.stringify({
            matchId,
            status: "COMPLETED"
        }))

        await redisClient.set(scorecardKey, JSON.stringify({
            matchId,    
            totalRuns: 320   
        }))

        await redisClient.set(commentaryKey, JSON.stringify({
            matchId,
            text: "Match completed"
        }))

        await redisClient.set(liveKey, JSON.stringify({
            matchId,
            status: "COMPLETED"
        }))

        await liveCache.promoteCompletedMatch(matchId)

        const summaryTTL = await redisClient.ttl(summaryKey)
        const scorecardTTL = await redisClient.ttl(scorecardKey)
        const commentaryTTL = await redisClient.ttl(commentaryKey)
        const liveTTL = await redisClient.ttl(liveKey)

        expect(summaryTTL).toBeGreaterThan(0)
        expect(summaryTTL).toBeLessThanOrEqual(CacheTTL.COMPLETED_MATCH.SUMMARY)

        expect(scorecardTTL).toBeGreaterThan(0)
        expect(scorecardTTL).toBeLessThanOrEqual(CacheTTL.COMPLETED_MATCH.SCORECARD)

        expect(commentaryTTL).toBeGreaterThan(0)
        expect(commentaryTTL).toBeLessThanOrEqual(CacheTTL.COMPLETED_MATCH.COMMENTARY)

        expect(liveTTL).toBeGreaterThan(0)
        expect(liveTTL).toBeLessThanOrEqual(CacheTTL.COMPLETED_MATCH.SUMMARY)
    })

    it("should isolate test keys from development keys", async () => {
        const testKey = CacheKeys.matchLive(matchId)
        const developmentKey = `match:${matchId}:live`
        await redisClient.set(developmentKey, JSON.stringify({
            source: "development"
        }))

        await redisClient.set(testKey, JSON.stringify({
            source: "test"
        }))

        await redisClient.del(testKey)

        const testValue = await redisClient.get(testKey)
        const developmentValue = await redisClient.get(developmentKey)

        expect(testValue).toBeNull()
        expect(JSON.parse(developmentValue)).toEqual({
            source: "development"
        })
        await redisClient.del(developmentKey)
    })

   

    it("should use a Redis key namespace",  () => {
        const key = CacheKeys.matchLive(matchId)
        expect(key).toBe(`test:criczone:match:${matchId}:live`)
    })
})

// Single Responsibility Principle (SRP)
// Dependency Injection (DI)
// Dependency Inversion Principle (DIP)
// Encapsulation
// Separation of Concerns (SoC)
// Open/Closed Principle (OCP)
// Test Isolation
// Environment/Data Isolation
// Safe Resource Management