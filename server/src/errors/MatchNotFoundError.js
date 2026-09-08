import NotFoundError from "./NotFoundError.js";

export default class MatchNotFoundError extends NotFoundError{
    constructor(matchID)
    {
        super(`Match with id ${matchID} was not found`, "MATCH_NOT_FOUND")
    }
}

// SRP — each error type represents one category of failure.
// OCP — we can add PlayerNotFoundError, TeamNotFoundError, etc. without changing AppError.
// LSP — MatchNotFoundError can be handled anywhere an AppError is expected.
// Inheritance / abstraction — common error behavior lives in the base class.