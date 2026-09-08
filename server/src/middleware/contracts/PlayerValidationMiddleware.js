export default class PlayerValidationMiddleware
{
    handle(req, res, next)
    {
        throw new Error("handle() must be Implemented")
    }
}