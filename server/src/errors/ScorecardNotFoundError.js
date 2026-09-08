import NotFoundError from "./NotFoundError.js"

export default class ScorecardNotFoundError extends NotFoundError{
    constructor(matchId)
    {
        super(`Scorecard for match id ${matchId} was not found`, 
            "SCORECARD_NOT_FOUND"
        )
    }
}

// LLD principles here are SRP, OCP, LSP, and inheritance reuse.