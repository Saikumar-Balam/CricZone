import TeamNotFoundError from "../errors/TeamNotFoundError.js"

export default class TeamService
{
    constructor(teamRepository)
    {
        this.teamRepository = teamRepository
    }
    async getTeams()
    {
        return await this.teamRepository.findAll()
    }
    async getTeamById(teamId)
    {
        const team = await this.teamRepository.findById(teamId)
        if(!team)
        {
            throw new TeamNotFoundError(teamId)
        }
        return team;
    }
    async getPlayersByTeamId(teamId)
    {
        await this.ensureTeamExists(teamId)
        return await this.teamRepository.findPlayersByTeamId(teamId)
    }
    async getMatchesByTeamId(teamId)
    {
        await this.ensureTeamExists(teamId)
        return await this.teamRepository.findMatchesByTeamId(teamId)
    }
    async getRankingByTeamId(teamId)
    {
        await this.ensureTeamExists(teamId)
        return await this.teamRepository.findRankingByTeamId(teamId)
    }
    async ensureTeamExists(teamId)
    {
        const team = await this.teamRepository.findById(teamId)
        if(!team)
        {
            throw new TeamNotFoundError(teamId)
        }
        return team;
    }
}
// LLD principles here:

// SRP — service owns Team use cases/business orchestration.
// DIP — depends on repository abstraction.
// DI — repository comes through the constructor.
// OCP/LSP — repository implementation can be substituted.
// Service Layer Pattern — business use cases stay out of controller/repository.