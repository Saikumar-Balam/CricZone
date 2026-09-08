import PlayerValidationMiddleware from "./contracts/PlayerValidationMiddleware.js";

export default class PlayerIdValidationMiddleware extends PlayerValidationMiddleware
{
    constructor(playerValidator)
    {
        super()
        this.playerValidator = playerValidator
        this.handle = this.handle.bind(this)
    }

    handle(req, res, next)
    {
        try {
            const playerId = this.playerValidator.validatePlayerId(
                req.params.playerId)
            req.params.playerId = playerId
            next()
        }
        catch(error)
        {
            next(error)
        }
    }
}
// LLD principles here are SRP, constructor DI, DIP support, 
// LSP, and separation of concerns.