export default class VenueRepository{
    async findAll()
    {
        throw new Error("findAll() must be implemented")
    }

    async findById(venueId)
    {
        throw new Error("findById() must be Implemented")
    }

    async findMatchesByVenueId(venueId)
    {
        throw new Error("findMAtchesByVenueId() must be Implemented")
    }
}

// Repository Pattern
// → persistence contract separated from business logic

// DIP
// → VenueService will depend on VenueRepository abstraction

// LSP
// → PostgresVenueRepository / MockVenueRepository can substitute each other

// ISP
// → contract contains only Venue-related persistence operations