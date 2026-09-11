export default class LiveCache {

    async getLiveState(matchId)
    {
        throw new Error("getLiveState() must be implemented")
    }

    async setLiveState(matchId, liveState)
    {
        throw new Error("setLiveState() must be implemented")
    }

    async invalidateScorecard(matchId)
    {
        throw new Error("invalidateScorecard() must be implemented")
    }

    async invalidateSummary(matchId){
        throw new Error("invalidateSummary() must be implemented")
    }

    async appendCommentary(matchId, commentaryEvent)
    {
        throw new Error("appendCommentary() must be implemented")
    }

    async getRecentCommentary(matchId)
    {
        throw new Error("getRecentMatchCommentary() must be implemented")
    }

    async promoteCompletedMatch(matchId)
    {
        throw new Error("promoteCompletedMatch() must be implemented")
    }
}
// SRP
// → Redis logic stays out of repository/service persistence code

// DIP
// → LiveUpdateService depends on LiveCache abstraction

// DI
// → RedisLiveCache is injected

// OCP
// → Redis implementation can later be replaced

// Separation of Concerns
// → PostgreSQL / Redis / WebSocket remain independent