import { CacheKeys } from "../CacheKeys.js";
import { CacheTTL } from "../CacheTTL.js";
import LiveCache from "../contracts/LiveCache.js";

export default class RedisLiveCache extends LiveCache {
    constructor(redisClient)
    {
        super()
        this.redisClient = redisClient
    }

    async getLiveState(matchId)
    {
        const key = CacheKeys.matchLive(matchId)
        const cached = await this.redisClient.get(key)
        if(!cached)
        {
            return null
        }
        return JSON.parse(cached)
    }

    async setLiveState(matchId, liveState)
    {
        const key = CacheKeys.matchLive(matchId)
        await this.redisClient.set(key, 
            JSON.stringify(liveState),{
                EX: CacheTTL.LIVE_MATCH
            }
        )
    }

    async invalidateScorecard(matchId)
    {
        const key = CacheKeys.scorecardByMatchId(matchId)
        await this.redisClient.del(key)
    }

    async invalidateSummary(matchId)
    {
        const key = CacheKeys.matchSummary(matchId)
        await this.redisClient.del(key)
    }

    async appendCommentary(matchId, commentaryEvent)
    {
        if(!commentaryEvent)
        {
            return
        }
        const key = CacheKeys.matchCommentary(matchId)
        await this.redisClient.lPush(key, 
            JSON.stringify(commentaryEvent)
        )
        await this.redisClient.lTrim(key, 0, CacheTTL.COMMENTARY_LIMIT-1)

        await this.redisClient.expire(key, CacheTTL.COMMENTARY)
    }

    async getRecentCommentary(matchId)
    {
        const key = CacheKeys.matchCommentary(matchId)
        const events = await this.redisClient.lRange(key, 0, CacheTTL.COMMENTARY_LIMIT-1)
        return events.map((event) =>
            JSON.parse(event))
    }

    async promoteCompletedMatch(matchId)
    {
        const summaryKey = CacheKeys.matchSummary(matchId)
        const scorecardKey = CacheKeys.scorecardByMatchId(matchId)
        const commentaryKey = CacheKeys.matchCommentary(matchId)
        const liveKey = CacheKeys.matchLive(matchId)

        await Promise.all([
            this.redisClient.expire(summaryKey, CacheTTL.COMPLETED_MATCH.SUMMARY),
            this.redisClient.expire(scorecardKey, CacheTTL.COMPLETED_MATCH.SCORECARD),
            this.redisClient.expire(commentaryKey, CacheTTL.COMPLETED_MATCH.COMMENTARY),
            this.redisClient.expire(liveKey, CacheTTL.COMPLETED_MATCH.SUMMARY)
        ])
    }
}