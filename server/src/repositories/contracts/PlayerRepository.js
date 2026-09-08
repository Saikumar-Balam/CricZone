export default class PlayerRepository 
{
    async findAll()
    {
        throw new Error("findAll() must be implemented")
    }
    async findById(playerId)
    {
        throw new Error("findById() must be implemented")
    }

    async findStatisticsByPlayerId(playerId)
    {
        throw new Error("findStatisticsByPlayerId() must be implemented")
    }
    async findRankingByPlayerId(playerId)
    {
        throw new Error("findRankingByPlayerId() must be implemented")
    }

    async findNewsByPlayerId(playerId)
    {
        throw new Error("findNewsByPlayerId() must be Implemented")
    }
}
// This gives us Repository Pattern + DIP + LSP + ISP.