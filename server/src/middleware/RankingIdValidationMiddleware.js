import RankingValidationMiddleware from "./contracts/RankingValidationMiddleware.js";

export default class RankingIdValidationMiddleware extends RankingValidationMiddleware
{
    constructor(rankingValidator)
    {
        super()
        this.rankingValidator = rankingValidator
        this.handle = this.handle.bind(this)
    }

    handle(req, res, next)
    {
        try{
            const rankingId = this.rankingValidator.validateRankingId(req.params.rankingId)
            req.params.rankingId = rankingId
            next()
        }
        catch(error)
        {
            next(error)
        }
    }
}
// This follows SRP, constructor DI, LSP, separation of concerns, and DIP support.