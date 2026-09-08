export default class NewsRepository{
    async findAll()
    {
        throw new Error("findAll() must be implemented")
    }

    async findById(newsId)
    {
        throw new Error("findById() must be implemented")
    }

    async findByPlayerId(playerId)
    {
        throw new Error("findByPlayerId() must be implemented")
    }

    async findByTeamId(teamId)
    {
        throw new Error("findByTeamId() must be implemented")
    }

    async findBySeriesId(seriesId)
    {
        throw new Error("findBySeriesId() must be implemented")
    }

    async findByMatchId(matchId)
    {
        throw new Error("findByMatchId() must be implemented")
    }
}
// This follows Repository Pattern, DIP, ISP, LSP, and OCP support.