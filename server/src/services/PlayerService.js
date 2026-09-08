import PlayerNotFoundError from "../errors/PlayerNotFoundError.js";

export default class PlayerService {
    constructor(playerRepository)
    {
        this.playerRepository = playerRepository
    }

    async getPlayers()
    {
        return await this.playerRepository.findAll();
    }

    async getPlayersById(playerId)
    {
        const player = await this.playerRepository.findById(playerId)
        if(!player)
        {
            throw new PlayerNotFoundError(playerId)
        }
        return player;
    }

    async getStatisticsByPlayerId(playerId)
    {
        await this.ensurePlayerExists(playerId)
        return await this.playerRepository.findStatisticsByPlayerId(playerId)
    }

    async getRankingByPlayerId(playerId)
    {
        await this.ensurePlayerExists(playerId)
        return await this.playerRepository.findRankingByPlayerId(playerId)
    }

    async getNewsByPlayerId(playerId)
    {
        await this.ensurePlayerExists(playerId)
        return await this.playerRepository.findNewsByPlayerId(playerId)
    }

    async ensurePlayerExists(playerId)
    {
        const player = await this.playerRepository.findById(playerId)
        if(!player)
        {
            throw new PlayerNotFoundError(playerId)
        }
        return player
    }
}

// LLD principles here are Service Layer Pattern, SRP, constructor DI, DIP, OCP/LSP support.