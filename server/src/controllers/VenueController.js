export default class venueController {
  constructor(venueService) {
    this.venueService = venueService;
    this.getVenues = this.getVenues.bind(this);
    this.getVenuesById = this.getVenuesById.bind(this);
    this.getMatchesByVenueId = this.getMatchesByVenueId.bind(this);
  }

  async getVenues(req, res, next) {
    try {
      const { venueId } = req.params;
      const venue = await this.venueService.getVenues();
      return res.status(200).json({
        success: true,
        data: venue,
      });
    } catch (error) {
      next(error);
    }
  }

  async getVenuesById(req, res, next) {
    try {
      const { venueId } = req.params;
      const venue = await this.venueService.getVenuesById(venueId);
      return res.status(200).json({
        success: true,
        data: venue,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMatchesByVenueId(req, res, next)
  {
    try{
    const {venueId} = req.params
    const matches = await this.venueService.getMatchesByVenueId(venueId)
    return res.status(200).json({
        success: true,
        data: matches
    })
  }
  catch(error)
  {
    next(error)
  }
}
}

// LLD principles here:

// SRP → controller handles HTTP only.
// Constructor DI → VenueService is injected.
// Separation of concerns → no SQL, DB access, or validation rules here.
// Testability → a mock service can be injected in tests.
