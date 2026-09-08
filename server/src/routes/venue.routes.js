import express from "express"


export const createVenueRouter = (venueController, venueIdValidationMiddleware) => {
    const router = express.Router()

    router.get("/", venueController.getVenues)
    router.get("/:venueId", venueIdValidationMiddleware.handle, venueController.getVenuesById)
    router.get("/:venueId/matches", venueIdValidationMiddleware.handle,
        venueController.getMatchesByVenueId
    )
    return router
}