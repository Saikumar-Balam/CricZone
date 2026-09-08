export default class ScorecardRepository 
{
    async findByMatchId(matchId)
    {
        throw new Error("findByMatchId() must be implemented")
    }

    async findInningsByScorecardId(scorecardId)
    {
        throw new Error("findInningsByScoreCard() must be implemenetd")
    }

    async findBattingPerformancesByInningsId(inningsId)
    {
        throw new Error("findBattingPerformanceByScoreccardId() must be implemented")
    }

    async findBowlingPerformancesByInningsId(inningsId)
    {
        throw new Error("findBowlingPerformanceByInningsId() must be implemented")
    }

    async recordBall(eventId, payload)
    {
        throw new Error("recordBall() must be implemented")
    }

}

// LLD principles here: Repository Pattern, DIP, ISP, LSP, and separation of persistence from orchestration.