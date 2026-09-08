import SeriesValidationMiddleware from "./contracts/SeriesValidationMiddleware.js"


export default class SeriesIdValidationMiddleware extends SeriesValidationMiddleware
{
    constructor(seriesValidator)
    {
        super()
        this.seriesValidator = seriesValidator
        this.handle = this.handle.bind(this)
    }

    handle(req, res, next)
    {
        try{
            const seriesId = this.seriesValidator.validateSeriesId(req.params.seriesId)
            req.params.seriesId = seriesId
            next()
        }
        catch(error)
        {
            next(error)
        }
    }
}
// This follows SRP, constructor DI, LSP, and separation of concerns.