import VenueValidator from "./contracts/VenueValidator.js";
import ValidationError from "../errors/ValidationError.js"
export default class VenueRequestValidator extends VenueValidator
{
    validateVenueId(venueId)
    {
        const id = Number(venueId)
        if(!Number.isInteger(id) || id<=0)
        {
            throw new ValidationError("venueId must be a positive integer",
                "INVALID_VENUE_ID"
            )
        }
        return id
    }
}
// LLD principles here are abstraction, SRP, OCP, LSP, and DIP support.