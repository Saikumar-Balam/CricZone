import NotFoundError from "./NotFoundError.js"

export default class RankingNotFoundError extends NotFoundError
{
    constructor(rankingId)
    {
        super(`Ranking with id ${rankingId} was not found`,
            "RANKING_NOT_FOUND"
        )
    }
}
// LLD principles:

// SRP
// OCP
// LSP
// Inheritance