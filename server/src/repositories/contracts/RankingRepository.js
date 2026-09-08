export default class RankingRepository 
{
    async findAll()
    {
        throw new Error("findAll() must be implemented")
    }

    async findById(rankingId)
    {
        throw new Error("findById() must be implemeented")
    }

    async findPlayerRankings()
    {
        throw new Error("findPlayerrankings() must be implemented")
    }

    async findTeamRankings()
    {
        throw new Error("findTeamRankings() must be implemented")
    }
}
// This applies Repository Pattern, DIP, ISP, LSP, and OCP support.