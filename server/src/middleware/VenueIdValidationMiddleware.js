import VenueValidationMiddleware from "./contracts/VenueValidationMiddleware.js";

export default class VenueIdValidationMiddleware extends VenueValidationMiddleware
{
    constructor(venueValidator)
    {
        super()
        this.venueValidator = venueValidator
        this.handle = this.handle.bind(this)
    }
    handle(req, res, next)
    {
        try{
            const venueId = this.venueValidator.validateVenueId(req.params.venueId)
            req.params.venueid = venueId
            next()
        }
        catch(error)
        {
            next(error)
        }
    }
}
// LLD principles here: SRP, constructor DI, LSP, separation of concerns, and DIP support.