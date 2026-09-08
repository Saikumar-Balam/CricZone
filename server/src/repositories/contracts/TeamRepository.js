export default class TeamRepository
{
    async findAll()
    {
        throw new Error("findAll() must be implemented")
    }
    async findById(teamId)
    {
        throw new Error("findById() must be implemented")
    }
    async findPlayersByTeamId(teamId)
    {
        throw new Error("findPlayersByTeamId() must be implemented")
    }
    async findMatchesByTeamId(teamId)
    {
        throw new Error("findMatchesByTeamId() must be implemented")
    }
    async findRankingByTeamId(teamId)
    {
        throw new Error("findRankingByTeamId() must be implemented")
    }
}

// Repository Pattern → persistence contract separated from business logic.
// DIP → TeamService will depend on TeamRepository, not PostgreSQL.
// ISP → this contract contains only Team-related persistence operations, not one giant cricket repository.
// OCP/LSP → PostgreSQL, mock, or another implementation can satisfy the same contract.