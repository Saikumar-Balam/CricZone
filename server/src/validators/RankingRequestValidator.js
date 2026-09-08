import RankingNotFoundError from "../errors/RankingNotFoundError.js";
import RankingValidator from "./contracts/RankingValidator.js";

export default class RankingRequestValidator extends RankingValidator
{
    validateRankingId(rankingId)
    {
        const id = Number(rankingId)
        if(!Number.isInteger(id) || id<=0)
        {
            throw new RankingNotFoundError("rankingId must be a positive integer",
                "INVALID_RANKING_ID"
            )
        }
        return id
    }
}
// LLD principles here are SRP, abstraction, OCP, LSP, and DIP support.