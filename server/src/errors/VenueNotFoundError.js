import NotFoundError from "./NotFoundError.js"
export default class VenueNotFoundError extends NotFoundError
{
    constructor(venueId)
    {
        super(`Venue with id ${venueId} was not found`,
            "VENUE_NOT_FOUND"
        )
    }
}
// LLD principles:

// SRP → only represents the Venue-not-found case.
// OCP → adds Venue-specific behavior without modifying base error classes.
// LSP → can be handled anywhere AppError is expected.
// Inheritance → common 404 behavior remains centralized.