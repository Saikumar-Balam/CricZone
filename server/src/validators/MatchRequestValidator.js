import MatchValidator from "./contracts/MatchValidator.js";
import ValidationError from "../errors/ValidationError.js"

export default class MatchRequestValidator extends MatchValidator{
    validateMatchId(matchId)
    {
        const id = Number(matchId)
        if(!Number.isInteger(id) || id<=0)
        {
            throw new ValidationError("MatchId must be a positive integer", 
                "INVALID_MATCH_ID")
        }
        return id;
    }
}