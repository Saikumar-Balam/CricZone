import NotFoundError from "./NotFoundError.js"

export default class PlayerNotFoundError extends NotFoundError
{
    constructor(playerId)
    {
        super(`Player with id ${playerId} was not found`, 
            "PLAYER_NOT_FOUND"
        )
    }
}
// LLD principles used:

// SRP → this class represents only the player-not-found case.
// OCP → we add a new error without modifying AppError or NotFoundError.
// LSP → PlayerNotFoundError can be handled anywhere an AppError is expected.
// Inheritance → common 404 behavior stays centralized.