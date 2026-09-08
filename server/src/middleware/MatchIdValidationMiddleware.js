import MatchValidationMiddleware from "./contracts/MatchValidationMiddleware.js"

export default class MatchIdValidationMiddleware extends MatchValidationMiddleware
{
    constructor(MatchValidator)
    {
        super()
        this.MatchValidator = MatchValidator
        this.handle = this.handle.bind(this)
    }
    handle(req, res, next)
    {
        try{
            const matchId = this.MatchValidator.validateMatchId(req.params.matchId)
            req.params.matchId = matchId
            next()
        }
        catch(error)
        {
            next(error)
        }
    }
}