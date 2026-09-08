export default class SeriesValidationMiddleware
{
    handle(req, res, next) 
    {
        throw new Error("handle() must be implemented")
    }
}