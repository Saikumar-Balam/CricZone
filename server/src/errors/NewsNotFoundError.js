import NotFoundError from "./NotFoundError.js"

export default class NewsNotFoundError extends NotFoundError
{
    constructor(newsId)
    {
        super(
            `news with id ${newsId} was not found`,
            "NEWS_NOT_FOUND"
        )
    }
}
// LLD principles here are SRP, OCP, LSP, and inheritance reuse.