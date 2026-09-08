import VenueNotFoundError from "../errors/VenueNotFoundError.js"


export default class VenueService 
{
    constructor(venueRepository)
    {
        this.venueRepository = venueRepository
    }

    async getVenues()
    {
        return await this.venueRepository.findAll()
    }

    async getVenuesById(venueId)
    {
        const venue = await this.venueRepository.findById(venueId)
        if(!venue)
        {
            throw new VenueNotFoundError(venueId)
        }
        return venue;
    }

    async getMatchesByVenueId(venueId)
    {
        await this.ensureVenueExists(venueId)
        return await this.venueRepository.findMatchesByVenueId(venueId)
    }

    async ensureVenueExists(venueId)
    {
        const venue = await this.venueRepository.findById(venueId)
        if(!venue)
        {
            throw new VenueNotFoundError(venueId)
        }
        return venue
    }
}

// LLD principles here: Service Layer Pattern, SRP, constructor DI, DIP, OCP/LSP support.