export default class StatisticsRepository{
    async findPlayerStatistics(playerId)
    {
        throw new Error("findPlayerStatistcis() must be implemented")
    }

    async findTeamStatistics(teamId)
    {
        throw new Error("findTeamStatistics() must be implemented")
    }

    async findSeriesStatistics(seriesId)
    {
        throw new Error("findSeriesStatistics() must be implemented")
    }
}
// LLD principles here are Repository Pattern, DIP, ISP, abstraction, and separation of derived-query logic from business orchestration.