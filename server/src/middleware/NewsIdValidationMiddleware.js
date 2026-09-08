import NewsValidationMiddleware from "./contracts/NewsValidationMiddleware.js";

export default class NewsIdValidationMiddleware extends NewsValidationMiddleware
{
    constructor(newsValidator)
    {
        super()
        this.newsValidator = newsValidator
        this.handle = this.handle.bind(this)
    }

    handle(req, res, next)
    {
        try{
            const newsId = this.newsValidator.validateNewsId(req.params.newsId)
            req.params.newsId = newsId
            next()
        }
        catch(error)
        {
            next(error)
        }
    }
}
// LLD principles here: SRP, constructor DI, LSP, DIP support, and reuse of existing abstractions.