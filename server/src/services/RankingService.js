import RankingNotFoundError from "../errors/RankingNotFoundError.js"

export default class RankingService {
    constructor(rankingRepository)
    {
        this.rankingRepository = rankingRepository
    }

    async getRankings()
    {
        return await this.rankingRepository.findAll()
    }

    async getRankingsById(rankingId)
    {
        const ranking = await this.rankingRepository.findById(rankingId)
        if(!ranking)
        {
            throw new RankingNotFoundError(rankingId)
        }
        return ranking;
    }

    async getPlayerRankings()
    {
        return await this.rankingRepository.findPlayerRankings()
    }

    async getTeamRankings()
    {
        return await this.rankingRepository.findTeamRankings()
    }
}
// Service Layer Pattern
// SRP
// Constructor DI
// DIP
// OCP/LSP support