import ValidationError from "../errors/ValidationError.js";
import NewsValidator from "./contracts/NewsValidator.js";

export default class NewsRequestValidator extends NewsValidator
{
    validateNewsId(newsId)
    {
        const id = Number(newsId)
        if(!Number.isInteger(id) || id<=0)
        {
            throw new ValidationError("newsId must be a positive integer",
                "INVALID_NEWS_ID"
            )
        }
        return id
    }
}

// LLD principles here are SRP, reuse, OCP, LSP, and avoiding duplicated validation logic.